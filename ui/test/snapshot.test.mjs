// Zero-dependency validation of the mock dashboard snapshot.
// Asserts shape against the documented contract and enforces the core
// OpenEmployee invariants:
//   * every external action name matches `mcp__<server>__<tool>`
//   * every credential reference uses the `auth_ref:` prefix
//   * no raw secret-looking values appear in the snapshot
//
// Run: node --test ui/test/

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_PATH = resolve(__dirname, "..", "mock", "snapshot.json");

const ACTIVITY_RE = /^mcp__[a-z0-9_]+__[a-z0-9_]+$/;
const AUTH_REF_RE = /^auth_ref:[^\s]+$/;
// Heuristic: anything that looks like a long opaque token we wouldn't want
// in the snapshot. Real secrets get blocked here even if a future change
// accidentally inlines them.
const SECRET_LIKE_RE = /(sk-[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/;

const loadSnapshot = async () => JSON.parse(await readFile(SNAPSHOT_PATH, "utf8"));

const requireFields = (obj, fields, label) => {
  for (const f of fields) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(obj, f),
      `${label} missing field "${f}": ${JSON.stringify(obj)}`,
    );
  }
};

test("snapshot loads and has top-level sections", async () => {
  const s = await loadSnapshot();
  requireFields(
    s,
    [
      "generated_at",
      "interactions",
      "signals",
      "candidates",
      "approvals",
      "recent_activities",
    ],
    "snapshot",
  );
  assert.ok(!Number.isNaN(Date.parse(s.generated_at)), "generated_at not a date");
});

test("inbound interactions are well-formed", async () => {
  const s = await loadSnapshot();
  assert.ok(s.interactions.length > 0, "expected at least one interaction");
  for (const it of s.interactions) {
    requireFields(
      it,
      ["id", "source", "received_at", "author_handle", "excerpt", "origin_activity", "origin_auth_ref"],
      "interaction",
    );
    assert.match(it.origin_activity, ACTIVITY_RE);
    assert.match(it.origin_auth_ref, AUTH_REF_RE);
  }
});

test("pmf signals reference real interactions and use known kinds", async () => {
  const s = await loadSnapshot();
  const knownKinds = new Set([
    "very_disappointed",
    "somewhat_disappointed",
    "not_disappointed",
    "must_have_quote",
    "churn_risk",
    "feature_gap",
    "bug_report",
    "praise",
  ]);
  const interactionIds = new Set(s.interactions.map((i) => i.id));
  for (const sig of s.signals) {
    requireFields(sig, ["id", "interaction_id", "kind", "confidence", "classifier_version"], "signal");
    assert.ok(knownKinds.has(sig.kind), `unknown signal kind "${sig.kind}"`);
    assert.ok(interactionIds.has(sig.interaction_id), `signal ${sig.id} references missing interaction ${sig.interaction_id}`);
    assert.ok(sig.confidence >= 0 && sig.confidence <= 1, `signal ${sig.id} confidence out of range`);
  }
});

test("issue candidates link back to signals and Activity proposals", async () => {
  const s = await loadSnapshot();
  const signalIds = new Set(s.signals.map((x) => x.id));
  const candidateIds = new Set(s.candidates.map((x) => x.id));
  for (const c of s.candidates) {
    requireFields(c, ["id", "title", "signal_ids", "status"], "candidate");
    for (const sid of c.signal_ids) {
      assert.ok(signalIds.has(sid), `candidate ${c.id} references missing signal ${sid}`);
    }
    if (c.status === "merged_into") {
      assert.ok(c.merged_into_id && candidateIds.has(c.merged_into_id), `candidate ${c.id} merged_into points nowhere`);
    }
    if (c.proposed_activity) assert.match(c.proposed_activity, ACTIVITY_RE);
    if (c.proposed_auth_ref) assert.match(c.proposed_auth_ref, AUTH_REF_RE);
  }
});

test("approval queue items gate Activities by auth_ref", async () => {
  const s = await loadSnapshot();
  const candidateIds = new Set(s.candidates.map((x) => x.id));
  const validDecisions = new Set(["pending", "approved", "denied", "expired"]);
  for (const a of s.approvals) {
    requireFields(
      a,
      ["id", "issue_candidate_id", "requested_at", "decision", "gated_activity", "gated_auth_ref"],
      "approval",
    );
    assert.ok(candidateIds.has(a.issue_candidate_id), `approval ${a.id} references missing candidate ${a.issue_candidate_id}`);
    assert.ok(validDecisions.has(a.decision), `approval ${a.id} bad decision "${a.decision}"`);
    assert.match(a.gated_activity, ACTIVITY_RE);
    assert.match(a.gated_auth_ref, AUTH_REF_RE);
  }
});

test("recent activity executions follow mcp__server__tool naming", async () => {
  const s = await loadSnapshot();
  const validStatus = new Set(["scheduled", "started", "completed", "failed", "cancelled"]);
  for (const a of s.recent_activities) {
    requireFields(
      a,
      ["activity_name", "workflow_id", "run_id", "attempt", "status", "scheduled_at", "auth_ref"],
      "activity",
    );
    assert.match(a.activity_name, ACTIVITY_RE);
    assert.match(a.auth_ref, AUTH_REF_RE);
    assert.ok(validStatus.has(a.status), `activity status "${a.status}" not allowed`);
    if (a.output_artifact_ref) {
      assert.ok(
        a.output_artifact_ref.startsWith("claimcheck://"),
        `activity ${a.activity_name} output should use claim-check ref`,
      );
    }
  }
});

test("snapshot contains no secret-shaped values", async () => {
  const raw = await readFile(SNAPSHOT_PATH, "utf8");
  const m = raw.match(SECRET_LIKE_RE);
  assert.equal(m, null, `secret-shaped token found in snapshot: ${m && m[0]}`);
});
