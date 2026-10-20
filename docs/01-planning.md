# 01 — Planning

## Problem and value

A single locally hosted team needs a privacy-conscious written standup service. Team members submit or correct tasks and blockers for today or the previous working day; leads review submissions, missing members, blockers, history and deterministic Markdown exports. Support can diagnose application/storage health without standup content in logs.

## Actors and glossary

- **Member:** synthetic roster entry identified by a stable ID.
- **Lead:** trusted local operator who can review and export team entries.
- **Support:** trusted local operator who checks health and operational logs.
- **Team date:** calendar date in `Asia/Kolkata`, never inferred from UTC timestamps.
- **Previous working day:** prior Monday–Friday date; Saturday/Sunday both resolve to Friday. No holiday calendar is configured.
- **v1 import:** command-line conversion of a legacy JSON file into current records.

## Scope

### In scope

One team per local deployment; configuration-loaded roster (1–50); React/TypeScript browser UI; versioned Express JSON API; SQLite persistence; shared validation; audit history; dashboard; date/member history; Markdown export; transactional/idempotent legacy JSON import; local checks and synthetic tests.

### Out of scope

Authentication/authorization, multiple teams, roster-management UI/API, member-specific timezones, holiday calendars, DST zones, cloud hosting, notifications, and modification of any supplied migration/performance dataset. No supplied dataset is currently present in this workspace; mandatory dataset-specific results therefore remain pending until it is provided.

## Assumptions and constraints

| ID | Statement | Basis | Status |
|---|---|---|---|
| A-01 | One trusted local operator is the caller; member ID is selected/provided, not authenticated. Roster roles (`member`, `lead`, `support`) are metadata only; all routes are equally available to this operator. Do not expose the service to an untrusted network. | No identity provider or authentication protocol is specified. | Conservative, unconfirmed assumption; role-based authorization remains unimplemented |
| A-02 | `Asia/Kolkata` is the configured zone; the code uses configurable IANA timezone logic and stores timestamps in UTC. | Product specification. | Confirmed requirement |
| A-03 | No holiday calendar exists; only Saturday/Sunday are skipped when calculating the previous working day. | Product specification. | Conservative assumption |
| A-04 | Content is plain text, not trusted HTML or executable Markdown. | Security/privacy requirement. | Proposed decision |
| A-05 | The legacy file schema is not included in the workspace; importer schema and mappings must be documented and adapted only when the approved v1 fixture is available. | Workspace inventory (only requirements and PDF are present). | Pending fixture |
| A-06 | Assignment submission consists of seven Markdown files in `docs/`; runnable source stays in this working repository and is not submitted. | Assignment instructions. | Confirmed requirement |

## Open decisions

| ID | Question | Proposed answer | Owner | Status |
|---|---|---|---|---|
| DEC-01 | Identity, permissions and trust? | No auth for the local single-user trusted deployment; explicit `memberId`; roles are loaded/displayed metadata, not security identities; all routes are available to that trusted operator. Document unsupported network exposure and missing role-based authorization. | Product owner (assumption) | Resolved as unconfirmed; permission enforcement gap disclosed |
| DEC-02 | Weekend dates and holidays? | Saturday and Sunday are valid current dates; dashboard includes today plus Friday when today is weekend; History shows all calendar dates; no holiday calendar, so holidays behave as weekdays. | Product owner | Resolved |
| DEC-03 | POST when entry exists? | Reject with HTTP 409; only PUT replaces an existing record. | Product owner | Resolved |
| DEC-04 | Audit content? | Store before/after tasks and blockers in audit records for update explainability; never log this content; audit access is local/trusted. | Product owner (privacy trade-off) | Resolved |
| DEC-05 | Import duplicates and winner? | Within one file, first valid occurrence wins; duplicates are reported/skipped. Existing DB rows are reported/skipped. Unique `(memberId, teamDate)` is authoritative. Unexpected batch/database failure rolls back all writes and import-job state. | Product owner | Resolved |
| DEC-06 | v1 conversion? | Require version 1 and a `standups` array. Resolve stable member ID first, otherwise exact normalized display name. A legacy `date`/`teamDate` anchors `today`; map nonempty `yesterday` to a second entry on the previous working day (Friday across weekends). Canonical `tasks` maps to one explicit-date entry. Split text by lines and strip common list prefixes; generic blockers map to today, optional `yesterdayBlockers` to yesterday. Never execute markup. | Product owner pending fixture | Provisional; fixture required |
| DEC-07 | Removed/renamed roster member? | Stable IDs preserve history. Rename updates the configured display name. Removed IDs are marked inactive and retained for historical display; inactive members are excluded from missing-member counts. | Product owner | Resolved |
| DEC-08 | Concurrent updates? | SQLite serializes writes; updates are last-write-wins and each accepted update records before/after audit values. There is no optimistic version token. | Product owner | Resolved |
| DEC-09 | Content limits and Markdown? | Tasks: 1–20 nonblank plain-text items, 1–500 Unicode chars each; blockers optional, max 1000 chars; reject NUL/control characters except tab/newline; trim outer whitespace. Escape markup in UI/export; deterministic Markdown escaping. | Product owner | Proposed, implement/test |

## Requirements and business rules

Stable IDs: REQ-F-01 through REQ-F-10, RULE-01 through RULE-08, DATA-01 through DATA-08, NFR-SEC-01, NFR-PERF-01, NFR-REL-01, NFR-OBS-01, NFR-ACC-01, NFR-MNT-01, NFR-PRI-01 and NFR-QUA-01, as defined in `requirements/requirements.md`.

## Risks

Full-assignment correction audit follow-up: supplied functional/migration/performance fixtures, container execution, timed spike, historical Git workflow and full accessibility checks remain incomplete. Embedded task-newline round trips and conflicting video-submission instructions need explicit product/program clarification. Runtime SQLite files are already Git-tracked and need safe repository hygiene. The complete owner/action inventory is maintained under Remaining risks and owners in [06-review.md](06-review.md); no missing historical activity is claimed as performed.

| ID | Risk | Impact | Mitigation | Trigger |
|---|---|---|---|---|
| R-01 | No supplied legacy/performance fixtures in workspace. | Cannot establish required dataset-specific outcomes or 10k-record measurement. | Implement deterministic fixtures only for local tests; clearly mark supplied-data work pending and request the approved fixture before submission. | Fixture remains unavailable |
| R-02 | No authentication on a local trusted app. | Standup confidentiality at risk if network-exposed. | Bind locally by default; explicit warning/documentation; do not claim authorization. | Non-local deployment requested |
| R-03 | Full before/after audit retains sensitive standup text. | More copies of private data. | Keep access local; no content logs; explain retention trade-off. | Wider access/retention request |
| R-04 | Legacy v1 schema differs from assumed envelope. | Import mapping may not match provided file. | Strict versioned parser, report unsupported records, inspect approved fixture before adapting. | Fixture is supplied |
| R-05 | Native SQLite dependency/build or Windows support issue. | Setup failure. | Pin supported dependencies, document tested runtime, run installation/build checks locally. | Install/build failure |
| R-06 | Assignment Git task workflow was not run in the existing working tree. | Required evidence/branch reviews absent. | Record gap honestly; create/review local branches and baseline/tag before submission if feasible. | Submission preparation |

## Technical spike

**Question:** Can a single SQLite unique constraint plus transaction support deterministic duplicate rejection and all-or-nothing import writes without relying on application-level race-prone checks?

**Decision criteria:** (1) two inserts with the same member/date cannot both commit; (2) a deliberate error after the first insert rolls back all rows; (3) SQLite can reopen persisted data. **Required timebox:** 30–60 minutes. **Actual timebox status:** not performed/logged as a dedicated timed spike; do not claim the assignment's timebox completed. Related focused evidence was run as tests: `npm run test -- --reporter=dot` exercised duplicate rejection, a forced ImportJob-trigger rollback, and SQLite close/reopen persistence. **Observations:** unique composite key enforced the duplicate invariant; injected job failure rolled back inserted records; reopened SQLite retained standup/audit. **Limitations:** test evidence is not a timed 30–60 minute spike and is not official dataset evidence. **Decision:** use DB unique constraint plus transaction, with verification evidence cited accurately. **Affected IDs:** RULE-02, REQ-F-09, REQ-F-10, NFR-REL-01, DATA-02, DATA-07, DATA-08.

## AI interaction records

| ID/stage | Related IDs | Context and request | Suggestion | Human decision | Action and verification | Limitation/follow-up |
|---|---|---|---|---|---|---|
| AI-001 Planning | all, DEC-01–09 | Supplied requirements and empty project inventory; resolve decisions and plan a compliant local application. | Explicit decisions for identity, dates, conflicts, audit, import, roster, concurrency and content. | Modify: no invented auth or dataset evidence; keep trust caveat and missing-fixture status visible. | Requirements file read first; workspace inventory showed requirements and PDF only. | Spike, fixture outcomes and branch workflow still need real evidence. |
