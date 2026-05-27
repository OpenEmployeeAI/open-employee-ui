// Static renderer for the feedback-loop dashboard.
// Reads the mock snapshot and paints each section. No framework, no network
// calls beyond fetching the bundled mock file. Replace the fetch URL when a
// live read-model endpoint is defined.

const SNAPSHOT_URL = "../mock/snapshot.json";

const $ = (sel) => document.querySelector(sel);

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) {
    if (c == null) continue;
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return node;
};

const decisionBadge = (decision) => {
  const cls = {
    approved: "ok",
    denied: "err",
    expired: "warn",
    pending: "accent",
  }[decision] || "";
  return el("span", { class: `badge ${cls}`, text: decision });
};

const activityBadge = (status) => {
  const cls = {
    completed: "ok",
    failed: "err",
    cancelled: "warn",
    started: "accent",
    scheduled: "",
  }[status] || "";
  return el("span", { class: `badge ${cls}`, text: status });
};

const card = (titleNode, rows) => {
  const node = el("div", { class: "card" });
  node.appendChild(titleNode);
  for (const r of rows) node.appendChild(r);
  return node;
};

const metaRow = (label, value) =>
  el("div", { class: "meta" }, [
    el("span", { text: `${label}: ` }),
    typeof value === "string" ? el("code", { text: value }) : value,
  ]);

const renderInteractions = (items) => {
  const root = $("#interactions");
  root.replaceChildren();
  for (const it of items) {
    const head = el("div", { class: "row" }, [
      el("span", { class: "title", text: it.source }),
      el("span", { class: "badge", text: it.author_handle }),
    ]);
    root.appendChild(card(head, [
      el("div", { text: it.excerpt }),
      metaRow("received_at", it.received_at),
      metaRow("origin_activity", it.origin_activity),
      metaRow("auth_ref", it.origin_auth_ref),
    ]));
  }
};

const renderSignals = (items) => {
  const root = $("#signals");
  root.replaceChildren();
  for (const s of items) {
    const head = el("div", { class: "row" }, [
      el("span", { class: "title", text: s.kind }),
      el("span", { class: "badge accent", text: `conf ${s.confidence.toFixed(2)}` }),
    ]);
    root.appendChild(card(head, [
      metaRow("interaction_id", s.interaction_id),
      metaRow("classifier_version", s.classifier_version),
    ]));
  }
};

const renderCandidates = (items) => {
  const root = $("#candidates");
  root.replaceChildren();
  for (const c of items) {
    const statusCls = {
      accepted: "ok",
      rejected: "err",
      merged_into: "warn",
      candidate: "accent",
    }[c.status] || "";
    const head = el("div", { class: "row" }, [
      el("span", { class: "title", text: c.title }),
      el("span", { class: `badge ${statusCls}`, text: c.status }),
    ]);
    const rows = [
      metaRow("signals", c.signal_ids.join(", ")),
    ];
    if (c.proposed_activity) rows.push(metaRow("proposed_activity", c.proposed_activity));
    if (c.proposed_auth_ref) rows.push(metaRow("proposed_auth_ref", c.proposed_auth_ref));
    if (c.merged_into_id) rows.push(metaRow("merged_into_id", c.merged_into_id));
    root.appendChild(card(head, rows));
  }
};

const renderApprovals = (items) => {
  const root = $("#approvals");
  root.replaceChildren();
  for (const a of items) {
    const head = el("div", { class: "row" }, [
      el("span", { class: "title", text: a.issue_candidate_id }),
      decisionBadge(a.decision),
    ]);
    const rows = [
      metaRow("requested_at", a.requested_at),
      metaRow("gated_activity", a.gated_activity),
      metaRow("gated_auth_ref", a.gated_auth_ref),
    ];
    if (a.decided_by) rows.push(metaRow("decided_by", a.decided_by));
    root.appendChild(card(head, rows));
  }
};

const renderActivities = (items) => {
  const root = $("#activities");
  root.replaceChildren();
  for (const a of items) {
    const head = el("div", { class: "row" }, [
      el("span", { class: "title", text: a.activity_name }),
      activityBadge(a.status),
    ]);
    const rows = [
      metaRow("workflow_id", a.workflow_id),
      metaRow("run_id", a.run_id),
      metaRow("attempt", String(a.attempt)),
      metaRow("scheduled_at", a.scheduled_at),
      metaRow("auth_ref", a.auth_ref),
    ];
    if (a.output_artifact_ref) rows.push(metaRow("output_artifact_ref", a.output_artifact_ref));
    root.appendChild(card(head, rows));
  }
};

async function main() {
  let snapshot;
  try {
    const res = await fetch(SNAPSHOT_URL, { cache: "no-store" });
    snapshot = await res.json();
  } catch (e) {
    $("#snapshot-meta").textContent = `Failed to load ${SNAPSHOT_URL}: ${e}`;
    return;
  }
  $("#snapshot-meta").textContent = `snapshot generated_at: ${snapshot.generated_at}`;
  renderInteractions(snapshot.interactions);
  renderSignals(snapshot.signals);
  renderCandidates(snapshot.candidates);
  renderApprovals(snapshot.approvals);
  renderActivities(snapshot.recent_activities);
}

main();
