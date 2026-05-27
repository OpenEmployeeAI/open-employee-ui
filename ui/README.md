# ui/ — feedback loop dashboard (design stub)

First small reviewable slice of the operator UI. Renders the intended
feedback monitoring + approval loop end-to-end against a static mock
snapshot. No framework, no build step, no backend calls.

## Layout

```
ui/
  contracts/feedback.d.ts    TypeScript view-model contracts
  mock/snapshot.json         Mock dashboard snapshot (no secrets)
  dashboard/index.html       Operator dashboard page
  dashboard/style.css
  dashboard/app.js           Renders snapshot.json into the page
  test/snapshot.test.mjs     Contract + invariant validation
```

## Sections rendered

1. **Inbound interactions** — chat / survey / support messages pulled in by a
   read-only MCP Activity (e.g. `mcp__intercom__list_conversations`).
2. **PMF signal taxonomy** — classifier-tagged signals
   (`very_disappointed`, `must_have_quote`, `bug_report`, …) with confidence
   and classifier version for audit.
3. **Issue candidates** — proposed tracked issues, linked back to the signals
   that motivated them, with the Activity proposed to materialize the issue
   (e.g. `mcp__github__create_issue`).
4. **Approval queue** — operator decisions gate each Activity by `auth_ref`.
   Activities are scheduled only after `decision == "approved"`.
5. **Recent Activity executions** — read-only view of `mcp__<server>__<tool>`
   Activities, with `workflow_id`, `run_id`, attempt, status, and
   claim-check artifact refs for large outputs.

## Invariants (enforced by tests)

- Every external action is an Activity boundary: name matches
  `^mcp__[a-z0-9_]+__[a-z0-9_]+$`.
- Every credential is referenced via `auth_ref:<…>` only — no raw secrets.
- Large outputs are referenced via `claimcheck://…`, never inlined.
- Approvals gate Activity scheduling; nothing here calls a provider live.

## Running locally

Serve `ui/` and open the dashboard:

```sh
python3 -m http.server -d ui 8000
# then visit http://localhost:8000/dashboard/
```

Validate the snapshot against contracts and invariants:

```sh
node --test ui/test/
```

## Not yet wired

- Live snapshot transport (replace the `fetch("../mock/snapshot.json")` in
  `dashboard/app.js`).
- Approve / Deny actions — currently read-only. These will become Temporal
  signals on the orchestrating workflow.
- Filtering, search, pagination.
