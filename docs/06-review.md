# 06 — Review

## Review scope and methods

Reviewed implementation against authoritative requirements IDs, test results, TypeScript/lint/build outputs, database uniqueness/transaction behavior, safe rendering/logging, accessible UI semantics and dependency audit. Reviewed diffs conceptually in this single working session; no independent reviewer, task branch review or merge was available/performed. Official migration/performance fixtures were absent.

## Material findings

| ID | Perspective | Related IDs | Evidence | Severity | Decision | Verification |
|---|---|---|---|---|---|---|
| FIND-01 | Specification readiness | REQ-F-08 | Fresh reviewer found health payload/status ambiguity; explicit response and Degraded rule were added; round 2 found no material wrong assumption. | Medium, resolved | Accept fix | `docs/02-specification.md` readiness rounds |
| FIND-02 | Data/privacy | NFR-SEC-01, NFR-PRI-01, DEC-01/04 | No auth; audit stores before/after private text; app binds loopback and logs no body/content. | High, accepted assumption | Accept only for trusted local use; no network exposure | HTTP logger implementation and response tests; manual log scan/gate pending |
| FIND-03 | Migration correctness | REQ-F-10, DATA-01–08 | Official v1 fixture/schema absent; field mapping is an explicit provisional envelope. | High, open | Do not claim official import conformity; obtain fixture and adapt/test before assignment completion | Synthetic tests only |
| FIND-04 | Process/evidence | Assignment Git workflow | The `spec-v1.0` specification baseline tag, task branches, task-prefixed commits, and branch review/merge records are missing. The requirement was identified only after implementation work had already been committed to `main`. | High, open process-compliance gap | Document the deviation, preserve repository history as-is, and intentionally do not reconstruct historical evidence | Documentation correction only; no commits, branches, tags, pushes, or retrospective review records created |
| FIND-05 | Performance | NFR-PERF-01 | Synthetic 20-member/10,000-row/500-date script gave all 10 samples <1ms in this local process. Official performance fixture absent. | Medium, partially verified | Accept local synthetic threshold only | `npm run perf` output summarized in 05-testing.md |
| FIND-06 | Accessibility | NFR-ACC-01 | RTL validates labels and form alert; no keyboard-only/manual screen-reader review. | Medium, open | Keep core semantic UI; require manual pass before declaring acceptance complete | Component tests only |
| FIND-07 | Dependency security | NFR-QUA-01 | Initial audit found Vitest/tinypool critical advisories; Vitest upgraded; final npm audit reported zero vulnerabilities. | High, resolved | Accept update | `npm run check` passed, including high-severity audit |
| FIND-08 | API scope | REQ-F-05, NFR-PERF-01 | Added optional bounded History range (max 30 dates) to allow performance test; single-date History remains supported. | Low, resolved | Accept additive API contract and update spec | API range test |
| FIND-09 | Deployment | Technical constraints | Dockerfile and Compose define one loopback-bound service and persistent SQLite volume; Docker CLI unavailable, so image build/start was not verified. | Medium, open | Keep npm-based start as verified path; container option is unverified | Native dev/browser smoke passed; container untested |
| FIND-10 | Browser/API reliability | REQ-F-05/07, NFR-OBS-01 | History showed fetch failures when the dev server was stopped; server logs also showed conditional API 304 responses. | Medium, resolved | Keep server process running; API disables ETags/conditional validators and sends no-store; UI provides actionable error/retry | API no-304 test, RTL failure/retry test, and browser History search pass |
| FIND-11 | Identity/permissions | DEC-01, synthetic role roster | Configured 10-member roster exposes member/lead/support metadata; there is no authentication or role-based access control. | High, accepted only under unconfirmed local trust assumption | Do not deploy on an untrusted network; role-based permission separation remains unimplemented | Roster metadata/mutation-route test only; no authorization claim |

## Focused traceability

Latest correction audit: TASK-07 adds TEST-16–20 to the original traceability below. REQ-F-02/03/04 now have explicit UI correction, prior-day status and API audit coverage; REQ-F-05/06 have historical-date export and inactive filtering. RULE-03/04 now have inactive write/history tests; RULE-05 includes actual create/update window rollover at midnight. NFR-REL-01 includes audit-insert failure rollback. NFR-PERF-01 now measures HTTP requests (maxima 32.120/21.226 ms, synthetic only). Latest NFR-QUA-01 gate: 42 tests, types/lint/secret scan pass, zero vulnerabilities. Original rows describe earlier evidence where not superseded here.

| ID | Design | Task | Test | Status |
|---|---|---|---|---|
| REQ-F-01 | Config roster + stable IDs and roles; data model | TASK-01/02 | TEST-01/13 | Role metadata is configured/API/UI visible; authorization remains outside the assumed trusted local model |
| REQ-F-02 | Shared create service and API/UI | TASK-01/02/04 | TEST-04/05/10 | Implemented/tested |
| REQ-F-03 | Transactional replace + audit before/after | TASK-02 | TEST-04/08 | Implemented/tested |
| REQ-F-04 | Dashboard active roster/status and both date panels | TASK-02/04 | TEST-10, API service coverage | Implemented; UI verifies today and previous-day task/blocker content |
| REQ-F-05 | Date/member query + explicit empty UI; bounded optional range | TASK-02/04/05 | TEST-07/10 | Implemented/tested |
| REQ-F-06 | Deterministic Markdown exporter and download | TASK-03/04 | TEST-05, TEST-09 | Implemented/tested synthetically |
| REQ-F-07 | Express versioned JSON API/envelopes | TASK-02 | TEST-05/06/07 | Implemented/tested |
| REQ-F-08 | SELECT/PRAGMA health probe; generic 503 | TASK-02 | TEST-06 | Implemented/tested |
| REQ-F-09 | SQLite durable rows/audit | TASK-01/02 | TEST-08 | Implemented/tested by reopen |
| REQ-F-10 | Strict importer, today/yesterday date expansion, idempotency, row report, transaction | TASK-03 | TEST-09/12 | Synthetic canonical/mapped, duplicate, existing-conflict and rollback tests pass; official fixture pending |
| RULE-01 | IANA timezone-derived date, UTC timestamps | TASK-01/02 | TEST-02/03 | Tested local midnight |
| RULE-02 | Composite unique member/date | TASK-01/02/03 | TEST-04/09 | Tested create/duplicate/import |
| RULE-03 | Stable member ID and retained inactive record | TASK-01/02 | TEST-01/13 | Stable IDs and schema-v2 role metadata implemented; rename/removal scenario not separately tested |
| RULE-04 | Zod fields/date/content/member validation | TASK-01/02/03 | TEST-01/04/09 | Tested positive/negative; some roster edges pending |
| RULE-05 | Today/previous-workday window | TASK-01/02 | TEST-03/04 | Weekend/local midnight tests pass |
| RULE-06 | Sorted escaped export | TASK-03 | TEST-05/09/11 | Markup escape and byte-determinism tested |
| RULE-07 | Name mapping, history, today/yesterday conversion, idempotency | TASK-03 | TEST-09/12 | Synthetic mapping tested; official input pending |
| RULE-08 | Shared schemas/service path | TASK-01/03 | TEST-01/09 | Implemented shared schema; importer test |
| NFR-SEC-01 | Validation/React text/Markdown escaping/parameterized SQL/no-store API | TASK-01/03/04 | TEST-01/05/09/11/15 | Automated boundaries/output safety pass; manual browser review pending |
| NFR-PERF-01 | Indexed date/member queries; bounded range | TASK-01/02/05 | TEST-07 + `npm run perf` | Synthetic pass; supplied fixture absent |
| NFR-REL-01 | SQLite persistence + import transaction | TASK-02/03 | TEST-08/09 | Tested |
| NFR-OBS-01 | Structured logs/correlation ID/no content | TASK-02/05 | TEST-05/06/11 | Structured IDs and task/blocker log redaction asserted |
| NFR-ACC-01 | Semantic labels/errors/focus styles/retry feedback | TASK-04 | TEST-10/14 | Automated labels and retry feedback pass; manual keyboard/screen reader pending |
| NFR-MNT-01 | Shared pure date/content/service modules | TASK-01/02/03 | TEST-01/02/03/09 | Tested without browser |
| NFR-PRI-01 | Synthetic fixtures and local trust | TASK-01/05 | TEST-09 + source review | Synthetic only; audit text is retained locally |
| NFR-QUA-01 | Tests/types/lint/secrets/audit single script | TASK-05/07 | `npm run check` | Latest pass: 42 tests; typecheck/lint/secret scan; 0 vulnerabilities |
| DATA-01–08 | Import mapping/report/duplicate policy | TASK-03 | TEST-09 | Synthetic analogues only; supplied cases unexecuted |

## Explain-back

1. **Composite uniqueness + import transaction:** durable DB uniqueness prevents concurrent duplicate member/date entries even if application checks race. The importer wraps successful records and job report in one SQLite transaction, so an unexpected exception leaves no partial import. Evidence: duplicate API/domain tests and a forced import-job trigger rollback test. It does not make the missing official schema safe by itself.
2. **Team-local time computation:** `Intl.DateTimeFormat` derives today from Asia/Kolkata; UTC timestamps are not used to decide team dates. Previous-workday logic skips Saturday/Sunday while retaining weekends as valid current dates. Evidence: tests immediately before/at the local midnight boundary and for Saturday/Sunday/Monday. DST zones remain out of scope.

## Rejected suggestions and false positives

Exploratory audit suggestions were checked against source. Missing-member export sorting already exists in the repository query; a new test confirms it. Creation audit events, UI timestamp display and pagination are not mandatory requirements; update-only audit meets REQ-F-03. Optional blockers normalizing to empty string is valid and now explicit. The health-only fresh-agent planning exercise meets the specified readiness scope. Required top-level headings must not be renamed. A freely supplied role would not provide authentication. Creating empty branches or tagging current code cannot repair a missing historical spec baseline. Demo-video instructions conflict and require clarification.

No material coding suggestion was rejected as unsafe. Readiness review's optional package-version-source question was not treated as a blocking gap because the specification explicitly selects package metadata. Early test failures and dependency audit findings were real and resolved; they are recorded in 05-testing.md.

## Remaining risks and owners

### Full assignment gap inventory after correction audit

| Gap / status | Affected requirements | Owner / next action |
|---|---|---|
| Fixed: correction actions absent from cards, saved previous-day target reset to today | REQ-F-02/03/04 | TASK-07 added edit/prefill/focus, preserved target/confirmation and duplicate-save guard; TEST-16/17 pass |
| Fixed: previous-day missing statuses invisible, no historical-date export, inactive history filter absent and inactive update allowed | REQ-F-04/05/06, RULE-03/04 | TASK-07 fixes verified by TEST-17/20 |
| Fixed: performance script timed service calls rather than requests | NFR-PERF-01 | Five real loopback HTTP samples each now pass; supplied fixture still required |
| Official functional roster, two-week migration fixture and supplied performance dataset unavailable | REQ-F-01/10, DATA-01–08, NFR-PERF-01, DEC-06 | Participant obtains unmodified original synthetic files, records each supplied case and five HTTP samples |
| Container build/start/restart unexecuted; no Docker/Podman command found during inspection | One application container + SQLite, REQ-F-09, NFR-REL-01 | Participant verifies deployment and committed standup/audit across container restart; DB reopen is not container proof |
| Timed 30–60 minute spike and phase timings not recorded | Required method steps 2/7 | Perform genuine future investigation with prewritten criteria and actual time/output; do not backdate |
| The `spec-v1.0` baseline tag, task branches, task-prefixed commits, and branch review/merge evidence were not created during development; the requirement was recognized only after implementation commits existed | Git workflow; open process-compliance gap | Participant: preserve existing history and disclose the deviation. Evidence was intentionally not recreated retroactively. Future projects should follow the required workflow from the beginning |
| Full keyboard-only, screen-reader and browser assessment unexecuted | NFR-ACC-01 | QA completes manual flows; focused browser Edit activation and RTL are partial evidence |
| No caller authentication or role enforcement; audit retention unapproved | DEC-01/04, NFR-SEC/PRI-01 | Product owner confirms local trust and retention; do not expose to untrusted networks |
| Embedded task newline round-trip unresolved: API/import allow it, textarea splits it and Markdown flattens it | RULE-08, DEC-09 | Product owner defines lossless representation/shared policy; implement multiline editor and tests before claiming full parity |
| Robustness edges not independently exercised | RULE-03/04, NFR-OBS/SEC/REL-01 | QA adds full configured-roster reload, concurrent last-write-wins, maximal Unicode/control limits, invalid-timezone startup, backup/restore and import-failure logging checks |
| Runtime DB/WAL/SHM already tracked despite ignore claim | Repository safety/hygiene | Participant backs up/quiesces service before intentionally untracking; no DB deletion/reset here |
| Demo link requested early in assignment but later instructions say no video; delivery location not verified | Submission rules | Confirm with program; keep exactly seven Markdown docs and application local pending clarification |
| Earlier stage records contain human Accept/Modify claims not independently verified in this audit | Genuine human evidence/declaration | Participant reviews and corrects decisions/timings/AI records; agent review is not human approval |

- Product owner/participant: supply approved synthetic legacy/performance fixtures; finalize exact v1 mapping and report DATA-01–08 actuals.
- Participant: execute a genuine 30–60 minute spike with timed raw evidence. Retain the Git workflow deviation as an open process-compliance gap without reconstructing historical evidence; apply the required workflow from the beginning of future projects.
- Participant/QA: manually check keyboard-only navigation, visible focus and screen-reader errors; capture final complete quality gate.
- Product owner: decide whether authentication is needed before any deployment outside a trusted local workstation.
- Product owner: approve retention/access policy for before/after audit content.

## AI interaction records

| ID/stage | Related IDs | Context and request | Suggestion | Human decision | Action and verification | Limitation/follow-up |
|---|---|---|---|---|---|---|
| AI-007 Review | FIND-01–08, REQ-F-01–10, NFR-* | Compare implementation evidence against spec; assess privacy, failure, performance, accessibility and process. | Report gaps explicitly; distinguish synthetic from supplied-data proof. | Accept; do not label app/assignment fully complete while fixture, spike, branch workflow and manual accessibility remain open. | Traceability compiled from design/services/tests; run final gate and update results. | Review is self-review, not independent human code review. |
| AI-008 Review/Build/Test | REQ-F-02–06, TASK-07, TEST-16–20 | User supplied full assignment and reported missing previous-day correction; backend/docs agents plus main-agent source review | Explicit correction, preserved target, historical controls, midnight/audit-failure tests, HTTP performance and gap inventory | User requested audit/fix; final human acceptance remains pending, not inferred | Full gate 42 tests passes; build passes; HTTP maxima 32.120/21.226 ms; browser edit prefill/focus smoke | Synthetic only; no new commits or real DB writes; no invented spike/branch evidence |
