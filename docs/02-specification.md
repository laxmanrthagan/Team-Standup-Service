# 02 — Specification

## Specification status

Version 1.0.5 (working specification, not a retroactive Git baseline); original baseline date 2026-10-17; v1 legacy importer; team timezone `Asia/Kolkata`; local single-team SQLite application. Database schema version 2 adds role metadata to the configured roster. Unresolved external inputs: approved v1 dataset/schema and supplied functional/performance fixtures. DEC-01 remains an unconfirmed local trust assumption and DEC-06 remains provisional. The assignment text also conflicts about whether to submit a demo video link; participant must obtain clarification.

## User and system behavior

- **Roster:** Load configuration at startup; require 1–50 unique stable IDs and unique nonblank names. Each configured record also has a `member`, `lead`, or `support` role exposed as metadata in the read-only roster/API and UI. Roles do not authorize requests: a trusted local operator can access every route; role-based permissions are explicitly not implemented. Configured active members appear in the current roster. Existing IDs retain historical identity; rename updates configured display label; removed IDs become inactive, remain addressable in old history, and are not counted missing (REQ-F-01, RULE-03, DEC-01).
- **Dates:** Compute today from the configured IANA team timezone, not UTC. Writable API/UI dates are exactly today and the previous working day. Previous working day skips Saturday/Sunday; Saturday and Sunday remain valid today dates. No holiday calendar. UTC timestamps are used only for created/updated/audit/import times (RULE-01, RULE-05).
- **Submit:** Caller supplies `memberId`, ISO `teamDate`, `tasks`, optional `blockers`. Shared Zod content/field rules apply. Unknown/inactive members, malformed dates, disallowed dates, empty/missing task lists and over-limit content fail with stable 4xx JSON errors (REQ-F-02, RULE-04, RULE-08).
- **Create/update:** POST creates only; existing `(memberId, teamDate)` returns 409. PUT replaces tasks/blockers; update creates an audit event containing prior/new values and a UTC timestamp. Concurrent edits use last-write-wins (REQ-F-03, RULE-02).
- **Correction editor:** Today and previous-working-day submitted cards expose a labelled Edit standup button. Activation selects the saved member/date, prefills tasks/blockers and focuses tasks. Save uses PUT for existing entries and POST for missing entries; target selectors and save are disabled during a request. Success identifies saved member/date/task count, updates visible content and preserves the selected writable date. Failure preserves the draft; a successful save followed by refresh failure explicitly distinguishes the saved write from the refresh error. Switching to another missing member/date clears the draft. Inactive members cannot create or update. The API rechecks the writable window on every write, including after local midnight (REQ-F-02/03/04, RULE-02/04/05, NFR-ACC-01).
- **Today:** Default dashboard date is team today. It returns deterministic active-member Submitted/Missing status and submitted content for today and previous working day. Saturday/Sunday dashboard date is included as today; its previous-day panel is Friday. Inactive members' historical entries may still display when directly requested but do not appear as missing (REQ-F-04).
- **History:** Browse an explicit valid calendar date, optionally filter by stable member ID; display all dates, including weekends, with an accessible empty state. Inactive member records retain their stable ID/name association for historical display (REQ-F-05).
- **Historical UI controls:** History's member filter includes retained inactive members, labelled inactive; the write selector and dashboard counts contain only active members. Export selected day downloads the entire selected calendar day, independent of the member filter, including historical/weekend dates (REQ-F-05/06, RULE-03).
- **Export:** Selected date returns Markdown containing active roster submissions/missing members; submitted records ordered by normalized display name then member ID; tasks retain input order; missing names sorted by normalized name then ID. Escape Markdown/HTML-significant characters so content cannot add headings/lists or execute; blockers absent/blank render as `None` (REQ-F-06, RULE-06).
- **Import:** CLI accepts strict v1 JSON, maps only known stable IDs/names and allows historical dates. Apply shared field/content validation, not the normal writable-window rule. For canonical `tasks`, create one entry on `teamDate`/`date`; for split legacy `today`/`yesterday`, create today on the explicit date and yesterday on the previous working day (Friday across weekends). Split task text by line and remove common list prefixes; generic blockers apply to today and optional `yesterdayBlockers` to yesterday. The report counts source records (`total`) and expanded standup candidates (`standupCandidates`) separately. First valid duplicate wins; later intra-file duplicate is skipped. If a candidate conflicts with a row already in the database, report it as a conflict and skip the incoming candidate; never overwrite stored standups. Unknown/malformed/missing/invalid rows are reported, never create members. All successful row insertions and import job state commit atomically; unexpected processing/storage error rolls back. Exact same file SHA-256 is a no-op. Markup-like text is plain text, never executed (REQ-F-10, RULE-07/08, DATA-01–08).
- **Failure/recovery:** Every API response uses `{success:true,data:...}` or `{success:false,error:{code,message}}`; logs include correlation ID and sanitized metadata only. Healthy health payload is `{status:"Healthy",database:{status:"Healthy",engine:"SQLite",schemaVersion:2},version:"<app-version>"}`. Degraded means the DB answers `SELECT 1` but reports a journal mode other than WAL; payload status and database.status are both `Degraded`. Unhealthy means the DB probe fails; return HTTP 503 `{success:false,error:{code:"DATABASE_UNAVAILABLE",message:"Database health check failed"}}`, and do not return details. Version is the application package version. SQLite uses foreign keys, busy timeout, WAL, indexed lookups and persistent local file (REQ-F-08/09, NFR-OBS-01, NFR-REL-01).
- **Content:** tasks 1–20 nonblank strings, 1–500 Unicode code points each. Blockers optional string up to 1000 Unicode code points; omitted blockers persist as the empty string, not null. Trim outer whitespace; permit newline/tab; reject NUL and other control characters. Plain text only; no HTML interpretation. UI uses one task per line and shared schemas for limits rather than HTML UTF-16 length truncation. Embedded task newlines from API/import are flattened by the current editor/export; lossless multiline-task round trips remain a documented limitation.

## Interface contract

| Endpoint or command | Input | Success | Error | Related IDs |
|---|---|---|---|---|
| GET `/api/v1/health` | none | 200 envelope, `data:{status,database:{status,engine,schemaVersion},version}`; status Healthy or Degraded | 503 `{success:false,error:{code:"DATABASE_UNAVAILABLE",message:"Database health check failed"}}` | REQ-F-08 |
| GET `/api/v1/members` | none | roster members, stable IDs, active flags | 5xx envelope | REQ-F-01 |
| GET `/api/v1/standups` | optional `teamDate`, `memberId` | matching entries | 400 malformed/filter; 404 unknown ID | REQ-F-07 |
| GET `/api/v1/standups/:id` | ID | entry with audit-safe fields | 400/404 | REQ-F-07 |
| POST `/api/v1/standups` | `{memberId,teamDate,tasks,blockers?}` | 201 created entry | 400 validation; 404 unknown member; 409 duplicate/date conflict | REQ-F-02/07 |
| PUT `/api/v1/standups/:id` | `{tasks,blockers?}` | 200 replaced entry; audit stored atomically | 400 validation/disallowed date; 404 missing entry/inactive member | REQ-F-03/07 |
| GET `/api/v1/history` | `teamDate` and optional `memberId`; alternatively inclusive `from` + `to` and optional `memberId` (maximum 30 calendar dates) | date or range, matching records, explicit empty list | 400 malformed dates/filter or range over 30 days | REQ-F-05/07, NFR-PERF-01 |
| GET `/api/v1/dashboard` | optional date (today or previous workday only) | date panels, roster statuses, submissions | 400 disallowed date | REQ-F-04/07 |
| GET `/api/v1/export/:date` | ISO date | JSON envelope with date and Markdown string | 400 malformed date | REQ-F-06/07 |
| `npm run import -- --file path.json` | v1 JSON; configured roster/database | report counts, per-row decisions, job ID | nonzero exit + rollback for fatal failure | REQ-F-10/DATA-01–08 |

## Data specification

| Entity or field | Type | Rules | Privacy |
|---|---|---|---|
| Member | ID, displayName, role, active | Stable primary key; configuration source; role is `member`, `lead`, or `support`; 1–50 configured roster members | Synthetic labels only; role is not an authorization claim |
| Standup | ID, memberId, teamDate, tasks, blockers, createdAtUtc, updatedAtUtc | unique member/date; FK; ISO date; task/blocker limits; timestamps UTC | Private standup text |
| AuditEvent | ID, standupId, eventType, timestampUtc, previousValue, newValue | updates record before/after content, UTC timestamp, FK | Contains private text; never log |
| ImportJob | ID, fileName, importedAt, status, file hash/report | hash makes identical file no-op; status/report transactional | Never log file content |

## Non-functional verification

| NFR ID | Method | Passing threshold |
|---|---|---|
| NFR-SEC-01 | API/UI/import validation tests; markup-like text rendering/export tests; inspect logs | Invalid writes rejected; markup remains inert/escaped; no tasks/blockers in logs |
| NFR-PERF-01 | Seed 20 members/10,000 records/500 dates; five loopback HTTP requests each for dashboard and 30-day history, timing through JSON body consumption | Every one of five samples < 500 ms (local, documented runtime); report official fixture separately from synthetic substitute |
| NFR-REL-01 | Restart persistence test; inject import failure after a write | Committed standup/audit survives reopen; failed batch adds zero records/job |
| NFR-OBS-01 | Capture startup/request/validation/storage/import logs | Structured JSON, correlation ID, no standup text |
| NFR-ACC-01 | RTL semantics tests and keyboard-only core-flow review | Labels/errors/focus present; core actions keyboard operable |
| NFR-MNT-01 | Unit tests import same validation/business service | Rule tests run without browser; UI/API/import share schemas |
| NFR-PRI-01 | Review roster/test/log fixtures | Synthetic data only; no personal/confidential data |
| NFR-QUA-01 | One `npm run check` | Tests, lint, types, secret scan and high-severity dependency audit all pass |

## Acceptance scenarios

| ID | Given | When | Then | Related IDs |
|---|---|---|---|---|
| AT-01 | Configured active member and writable date | POST valid tasks | One row persists and returns 201 | REQ-F-01/02, RULE-02 |
| AT-02 | Existing member/date row | POST same pair | 409 and original remains unchanged | RULE-02, DATA-07 |
| AT-03 | Existing row | PUT changed tasks/blockers | Row replaced and before/after audit persists | REQ-F-03/09 |
| AT-04 | Team-local Friday/Sat/Sun/Mon date | Calculate previous working day | Friday for Sat/Sun/Mon; Friday on Monday; local midnight switches team date | RULE-01/05 |
| AT-05 | Active roster with partial submissions | Read dashboard | Every active member Submitted/Missing and both relevant date panels render | REQ-F-04 |
| AT-06 | Date with no entries; then member filter | Read history | Stable empty state and filtered results | REQ-F-05 |
| AT-07 | Same data and roster | Export twice | Byte-identical Markdown, deterministic ordering, content escaped | REQ-F-06, RULE-06, DATA-06 |
| AT-08 | Healthy DB; then unavailable DB | Read health | Healthy 200 then failure 503 envelope; no content logged | REQ-F-08, NFR-OBS-01 |
| AT-09 | Valid/invalid/duplicate/import-existing rows | Import JSON twice | Report every row; no member creation; no duplicate growth; rollback on fatal error | REQ-F-10, DATA-01–08 |
| AT-10 | Persisted entry and audit | Reopen app/database | Both remain available | REQ-F-09, NFR-REL-01 |
| AT-11 | Friday entry on Saturday, Sunday or Monday | Activate Edit, change tasks/blockers and save | Prefilled keyboard-focusable editor; PUT replaces same entry; audit added; saved date retained and confirmed | REQ-F-02/03/04, NFR-ACC-01 |
| AT-12 | Missing prior-day entry; saved/unsaved drafts | Submit, switch targets, or encounter save/refresh failure | POST for missing; drafts clear on target change, survive failed writes; refresh failure does not imply saved write failed | REQ-F-02/03, NFR-ACC-01 |
| AT-13 | Monday immediately before/at local midnight into Tuesday | Correct Friday or Monday | Friday closes at midnight with no mutation/audit; Monday becomes previous working day and stays writable | RULE-01/02/05 |
| AT-14 | Historical date and retained inactive member | Filter history or export selected day | Inactive history remains filterable; export uses selected day, not the write-form date/member filter | REQ-F-05/06, RULE-03 |
| AT-15 | Audit INSERT storage failure | Correct a writable saved entry | Neither standup replacement nor audit event commits | REQ-F-03/09, NFR-REL-01 |

## Human decisions that remain

DEC-01 local trust/no authentication remains unconfirmed by an external stakeholder. The approved legacy fixture/schema and performance fixture are not available in the current workspace; DEC-06 remains provisional until inspected. No holiday calendar will be inferred.

## Specification readiness check

**Round 1 (fresh Explore agent, specification only):** Asked for an implementation plan for REQ-F-08. It identified one material gap: exact success JSON structure was not explicit; it also asked about Degraded triggers and probe/version semantics. The plan otherwise correctly inferred a SQLite probe and 503 on failure. **Human resolution:** specified exact nested JSON shape, app version source, SQLite schema version and Degraded rule (successful SELECT 1 with non-WAL journal mode). These are now in User and system behavior and Interface contract.

**Round 2 (fresh Explore agent, specification only):** It produced the same plan, identified no material wrong assumptions and said implementation is possible with at most one clarification. Its sole optional question was whether to read `version` from package metadata or an environment variable; the contract already says application package version, so no further clarification is needed. **Outcome: passed** for REQ-F-08; no code was requested. The optional probe-scope/correlation questions are answered by the stated SELECT/journal-mode logic and shared request middleware.

## Change history

| Version | Change | Reason | Related IDs |
|---|---|---|---|
| 1.0 | Initial testable behavior, contracts, limits and assumptions derived from authoritative requirements | Implementation baseline | REQ-F-01–10, RULE-01–08, DATA-01–08, NFR-* |
| 1.0.1 | Clarified health payload shape, version source, Degraded condition and 503 behavior after independent readiness review | Close material ambiguity found in round 1 | REQ-F-08 |
| 1.0.2 | Added optional bounded 30-date History API range query | Enable the specified 30-day history performance measurement with one indexed request | REQ-F-05/07, NFR-PERF-01 |
| 1.0.3 | Defined split v1 `today`/`yesterday` conversion and source-versus-expanded import report counts | Resolve DEC-06 explicitly and preserve both days of legacy content | REQ-F-10, RULE-07/08, DATA-01–08 |
| 1.0.4 | Added read-only configured role metadata, explicitly documented lack of role-based authorization, and updated SQLite schema version | Address synthetic role roster while preserving the local trusted-operator decision | REQ-F-01, REQ-F-08, DEC-01 |
| 1.0.5 | Explicit correction editor, preserved save target/confirmation, prior-day missing statuses, historical export/inactive filtering, inactive update rejection, HTTP performance method, and residual multiline limitation | User-reported correction discoverability gap and full assignment audit | REQ-F-02–06, RULE-02–05, NFR-ACC/PERF/REL-01 |

## AI interaction records

| ID/stage | Related IDs | Context and request | Suggestion | Human decision | Action and verification | Limitation/follow-up |
|---|---|---|---|---|---|---|
| AI-002 Specification | REQ-F-01–10, RULE-01–08, DATA-01–08 | Requirements and nine unresolved decisions; produce implementable limits/contracts/scenarios. | Define explicit duplicate, update, audit, import and date behavior with consistent envelope. | Modify: document missing fixture and no-auth assumption rather than imply evidence. | Specification cross-referenced to requirements; acceptance scenarios added. | Fixture mapping remains provisional. |
| AI-003 Specification readiness | REQ-F-08 | Fresh agent received only this specification; asked for implementation plan and clarifications, no code. | Found response shape/Degraded semantics ambiguous; proposed one blocking clarification plus defaults. | Accept finding; answered in spec with exact response and status rule. | Updated contract/behavior and ran independent second round. | Initial review required a single contract clarification. |
| AI-004 Specification readiness | REQ-F-08 | Fresh agent received only revised specification; requested plan, gaps and maximum clarification count. | Found no material wrong assumptions; one optional version-source question. | Accept: package metadata was explicitly specified, so no clarification is needed. | Readiness check passed after two rounds; no implementation requested. | Review only covered REQ-F-08 by assignment design. |
