// Feedback monitoring + approval dashboard contracts.
//
// These are UI-facing view models. Authoritative event shapes live in the
// runtime repo; the UI consumes denormalized snapshots over a yet-to-be-defined
// transport. Every external side-effect referenced here MUST be expressed as
// an MCP Activity boundary: name = `mcp__<server>__<tool>`, credentials by
// `auth_ref` only.

export type AuthRef = `auth_ref:${string}`;

export type ActivityName = `mcp__${string}__${string}`;

export type PmfSignalKind =
  | "very_disappointed"   // Sean Ellis PMF survey: "very disappointed" cohort
  | "somewhat_disappointed"
  | "not_disappointed"
  | "must_have_quote"     // qualitative "would be a must-have" phrasing
  | "churn_risk"          // negative sentiment, threat to cancel, etc.
  | "feature_gap"         // user described a missing capability
  | "bug_report"
  | "praise";

export type IssueStatus =
  | "candidate"           // proposed by classifier; awaits human triage
  | "accepted"            // promoted to a tracked issue
  | "rejected"
  | "merged_into";        // duplicate folded into another candidate

export type ApprovalDecision = "pending" | "approved" | "denied" | "expired";

/** Raw inbound interaction (chat msg, survey response, support ticket, etc.). */
export interface InboundInteraction {
  id: string;
  source: string;                // e.g. "intercom", "discord", "survey"
  received_at: string;           // ISO-8601
  author_handle: string;         // opaque handle, never PII
  excerpt: string;                // short, redacted preview
  // The Activity boundary that pulled this interaction in.
  origin_activity: ActivityName;
  origin_auth_ref: AuthRef;
}

export interface PmfSignal {
  id: string;
  interaction_id: string;
  kind: PmfSignalKind;
  confidence: number;            // 0..1
  classifier_version: string;    // for auditability
}

export interface IssueCandidate {
  id: string;
  title: string;
  signal_ids: string[];          // PmfSignal.id values that motivated it
  status: IssueStatus;
  merged_into_id?: string;
  proposed_activity?: ActivityName; // e.g. mcp__github__create_issue
  proposed_auth_ref?: AuthRef;
}

export interface ApprovalItem {
  id: string;
  issue_candidate_id: string;
  requested_at: string;
  decision: ApprovalDecision;
  decided_by?: string;           // operator handle
  // The Activity that will fire IFF approval == "approved".
  gated_activity: ActivityName;
  gated_auth_ref: AuthRef;
}

/** Reference to a Temporal Activity execution (read-only view). */
export interface ActivityExecutionRef {
  activity_name: ActivityName;
  workflow_id: string;
  run_id: string;
  attempt: number;
  status: "scheduled" | "started" | "completed" | "failed" | "cancelled";
  scheduled_at: string;
  // claim-check pointer for any large output; never inline payloads here.
  output_artifact_ref?: string;
  // The auth_ref the Activity resolved (still a reference, never a secret).
  auth_ref: AuthRef;
}

export interface DashboardSnapshot {
  generated_at: string;
  interactions: InboundInteraction[];
  signals: PmfSignal[];
  candidates: IssueCandidate[];
  approvals: ApprovalItem[];
  recent_activities: ActivityExecutionRef[];
}
