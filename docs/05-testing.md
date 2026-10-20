# 05 — Testing

## Test strategy

Scope: shared validation/date rules, SQLite services, importer/exporter, HTTP contract, React components, persistence, failure and local performance. Environment: Windows, Node v24.20.0/npm 11.19.0, Vitest, RTL, Supertest, better-sqlite3, temporary SQLite databases. Tests use synthetic roster names and records only. Entry: npm dependencies installed; exit: test/type/lint/build/security/audit results reported, with unavailable official fixture work explicitly residual.

## Requirement coverage and results

| Test ID | Requirement IDs | Scenario | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|---|
| TEST-01 | RULE-04/08, NFR-MNT-01 | Shared validation: valid content, empty tasks, invalid calendar date, length limit | Valid accepted; invalid rejected | Passed in final suite | Pass | `server/src/tests/domain.test.ts` |
| TEST-02 | RULE-01/05 | Kolkata date around UTC 18:30 boundary | Local date changes at expected instant | Passed in final suite | Pass | `server/src/tests/domain.test.ts` |
| TEST-03 | RULE-01/02/05 | Sat/Sun/Mon and Tuesday previous workday; write today/previous/old date | Correct Friday resolution and exact writable window | Passed in final suite | Pass | `server/src/tests/domain.test.ts` |
| TEST-04 | REQ-F-02/03, RULE-02/04 | Create, duplicate, unknown member, update and before/after audit | Create, 409/domain rejection, audit exact values | Passed in final suite | Pass | `server/src/tests/domain.test.ts`, `server/src/tests/api.test.ts` |
| TEST-05 | REQ-F-07, NFR-OBS-01 | API CRUD, envelopes, correlation ID, markup-safe export | Consistent success/error, safe markdown | Passed in final suite | Pass | `server/src/tests/api.test.ts` |
| TEST-06 | REQ-F-08 | Healthy and closed-storage health probes | 200 Healthy; 503 generic failure | Passed in final suite | Pass | `server/src/tests/api.test.ts` |
| TEST-07 | REQ-F-05, NFR-PERF-01 | Single-date and bounded 30-day History, reject >30 days | Stable results; bounded range | Passed in final suite | Pass | `server/src/tests/api.test.ts` |
| TEST-08 | REQ-F-09, NFR-REL-01 | Close/reopen SQLite with standup and audit | Both data types persist | Passed in final suite | Pass | `server/src/tests/domain.test.ts` |
| TEST-09 | REQ-F-10, RULE-07/08, DATA-01–08 | Synthetic v1 canonical and today/yesterday mapping, duplicate, existing row, invalid date, unknown, missing field, idempotency, markup and forced transaction error | Correct date expansion/report, same-file no-op, no partial writes on fatal failure | Synthetic tests pass; no official DATA fixture was supplied/run | Partial | `server/src/tests/domain.test.ts` |
| TEST-10 | REQ-F-04/05, NFR-ACC-01 | Dashboard statuses/labels, shared content validation, History empty state | Accessible labels/errors and expected screen state | RTL tests pass, including 501-character rejection before network write; manual keyboard/screen reader run not performed | Partial | `client/src/tests/App.test.tsx` |
| TEST-11 | NFR-SEC-01, NFR-OBS-01 | Markup text in export, repeat export, and capture structured request logs | Markup encoded; same data exports identically; logs omit tasks/blockers | Escaping/determinism and direct task/blocker log-redaction assertion pass | Pass for tested paths | `server/src/tests/api.test.ts`, `server/src/tests/domain.test.ts` |
| TEST-12 | REQ-F-10, DATA-04 | Run documented importer CLI with one synthetic valid row and one unmapped name using a temporary DB | Import valid row; report unknown name; leave roster unchanged | CLI reported total 2, imported 1, rejected 1 with `Unknown member name.`; temp DB removed | Pass, synthetic smoke only | `npm run import -- --file server/import-smoke.json` |
| TEST-13 | REQ-F-01, DEC-01 | Read configured 10-member roster with member/lead/support roles; attempt roster mutation | Role metadata returned; no roster CRUD route | 10 members include lead/support; POST mutation returns standard 404 envelope | Pass for local trust model; authorization is not implemented | `server/src/tests/api.test.ts` |
| TEST-14 | REQ-F-05, NFR-ACC-01 | Fail History fetch once; show guidance; retry same search | Useful offline error and successful retry | RTL confirms helpful message, retry reaches empty-state response | Pass | `client/src/tests/App.test.tsx` |
| TEST-15 | REQ-F-07, NFR-SEC-01 | Request API with conditional cache validators | JSON 200 response, no ETag/304, `Cache-Control: no-store` | API test returns 200 with no-store and no ETag | Pass | `server/src/tests/api.test.ts` |
| TEST-16 | REQ-F-02/03/04, RULE-02/05, NFR-ACC-01 | Friday correction on Sat/Sun/Mon through editor and API | Prefill/focus; PUT same entry; audit added; target date retained and confirmation shown | All parameterized UI/API cases pass | Pass | [UI tests](../client/src/tests/App.test.tsx), [API tests](../server/src/tests/api.test.ts) |
| TEST-17 | REQ-F-02/03, NFR-REL/ACC-01 | Missing prior-day POST; refresh/write failures; target changes; duplicate submit | Saved write distinguished from failed refresh; draft retained on failed write; clear on target change; one pending request | All regression cases pass | Pass | [UI tests](../client/src/tests/App.test.tsx) |
| TEST-18 | RULE-01/02/05 | Monday 18:29:59.999Z then 18:30:00Z (Kolkata midnight) | Friday create/update closes; Monday update stays writable; rejected write leaves record/audit unchanged | Pass with injected clock | Pass | [Domain tests](../server/src/tests/domain.test.ts) |
| TEST-19 | REQ-F-03/09, NFR-REL-01 | Audit insertion trigger aborts correction | Original tasks/blockers/timestamp and zero audit additions | Pass | Pass | [Domain tests](../server/src/tests/domain.test.ts) |
| TEST-20 | REQ-F-05/06, RULE-03/04/06 | Retained inactive history filter; arbitrary historical export date; inactive writes; sorted missing export | History addressable; export receives chosen date; inactive write denied; missing order sorted | Pass; UI export test checks requested date via mocked API, not native file download | Pass for automated paths | [UI tests](../client/src/tests/App.test.tsx), [domain tests](../server/src/tests/domain.test.ts) |

## Required coverage summary

- **Normal:** API creates/lists/reads/updates; UI dashboard/history; export, importer success and seed path covered.
- **Negative/boundary:** invalid dates, empty/oversized tasks, unknown member, duplicate, disallowed write date, malformed range and >30-day range covered by tests.
- **Timezone boundary:** `Asia/Kolkata` local midnight tested immediately before/at UTC 18:30; Friday/Saturday/Sunday/Monday behavior covered. DST explicitly out of scope.
- **API:** Supertest versioned endpoints, error envelopes, duplicate and health failure covered; conditional cache request returns non-304 JSON response.
- **Migration:** Synthetic importer tests include idempotency/rollback and the actual CLI smoke reports an unmapped name; mandatory supplied legacy records DATA-01–08 not run because fixture is absent. v1 mapping is provisional.
- **Restart/failure:** SQLite reopen preserves standup/audit; forced ImportJob trigger proves transaction rollback; closed DB returns health 503.
- **Accessibility:** Semantic labels and RTL validation/navigation-state test; a keyboard-only manual pass, screen-reader check and browser matrix remain unexecuted.
- **Security:** Plain React text rendering, strict schemas, escaped export and parameterized queries. Secret scan and npm high severity audit are part of `npm run check`; no penetration test performed.
- **Local browser/API smoke:** After restarting the stopped dev services, `GET /api/v1/health` returned Healthy with schema version 2; `GET /api/v1/members` returned 10 synthetic members including lead/support metadata. Browser History navigation and search rendered four synthetic records. The local app is currently running in the shared browser environment; user may restart it with `npm run dev` if that terminal is later stopped.

## Quality gate output

Command: `npm run check` (tests, typecheck, ESLint, local secret scan, `npm audit --audit-level=high`). **Latest actual result: PASS**, correction-audit session (terminal performance timestamps 2026-10-20T00:33Z; session context began 2026-10-19). Three test files passed (42 tests); both TS configs passed; ESLint passed; secret scan passed; npm reported 0 vulnerabilities. `npm run build` also passed (with upstream Zod annotation-position warnings only). This supersedes the earlier 27-test gate, not its historical occurrence.

```text
> Test Files  3 passed (3)
> Tests  42 passed (42)
Secret scan passed: no credential-like assignments in scanned source/docs.
found 0 vulnerabilities
```

## Performance check

Method: `npm run perf` creates a temporary 20-member, 10,000-standup/500-team-date SQLite dataset and loopback Express server. Dashboard and inclusive 30-calendar-day History HTTP requests each measured five times through JSON body consumption. Passing threshold, defined before execution: every local sample <500 ms. This is a synthetic substitute, not the missing official performance fixture. Latest run observed on Windows local workspace (2026-10-20T00:33Z):

| Operation | Five results (ms) | Maximum (ms) | Records returned | Threshold | Result |
|---|---|---:|---:|---:|---|
| Today dashboard | 32.120, 3.756, 19.895, 17.751, 5.692 | 32.120 | 40 across today + previous-day panels | 500 | Pass, synthetic HTTP only |
| 30-day History | 9.288, 18.271, 5.463, 8.238, 21.226 | 21.226 | 600 | 500 | Pass, synthetic HTTP only |

Caveat: first run includes warm/cache variance; no official dataset or hardware baseline supplied. Do not generalize these results beyond this local synthetic check.

Earlier maxima 0.768/0.681 ms measured direct service calls, not HTTP requests; retained only as historical context and not the current request-performance evidence.

Focused browser smoke (no writes to the user's database): full reload, keyboard Enter on a previous-day Edit action selected 2026-10-19, displayed Edit saved standup, prefilled synthetic task text and focused the tasks field. History exposed Export selected day. This is not a complete keyboard/screen-reader or cross-browser assessment. Automated tests perform correction writes against temporary SQLite databases only.

## Failures fixes and retests

- Correction regressions initially failed on ambiguous textarea/list text assertions (three parameterized cases), exact optional-property typing, and a validation test racing dashboard initialization. Scoped the list assertion, corrected optional typing and awaited initialized date. Subsequent `npm run check`: 42 passed, types/lint/scan/audit passed. No material product failure was hidden.
- Initial Vitest invocation found no tests due incorrect globs; changed paths relative to Vite root and reran.
- RTL then found ambiguous names due missing cleanup and selector assumptions; added cleanup and unique queries.
- API test initially used a date outside the live team-date window; injected deterministic time in tests. Export assertion initially checked old text after update; corrected to test persisted markup-like text.
- TypeScript caught importer row union and missing Supertest types; fixed both.
- ESLint failures fixed with explicit Node globals, used `next` for headers-sent errors, and shared control validation without lint suppression.
- Initial npm audit high-severity gate failed due Vitest's `tinypool`; upgraded Vitest and install reported zero vulnerabilities. Final `npm run check` then passed, including audit.

## Unexecuted tests and residual risk

- Official roster/migration/performance fixtures are not in this workspace; cannot report real DATA-01–08 case outcomes, conflicting-legacy winner behavior on actual supplied records, or official 10k measurement.
- 30–60-minute timed spike was not logged as a timed activity. Transaction/unique/idempotency/rollback assertions were implemented and executed as tests, but this does not substitute for the documented timebox requirement.
- Fresh-agent readiness check passed for REQ-F-08 only; no claim of broader independent spec validation.
- Task-specific Git branches, baseline tag, and branch review workflow were not performed.
- Role-based authorization is not implemented: the local deployment's roles are metadata and do not identify callers; this is an explicit DEC-01 trust assumption and a gap against any expected permission separation.
- Manual keyboard/screen-reader and cross-browser assessment not run.

## AI interaction records

| ID/stage | Related IDs | Context and request | Suggestion | Human decision | Action and verification | Limitation/follow-up |
|---|---|---|---|---|---|---|
| AI-006 Test | TEST-01–15, NFR-* | Ran test/type/lint/build/audit commands and evaluated failure output. | Fix actual failing selectors, test determinism, strict typing, cache behavior and vulnerable test dependency. | Accept fixes; rejected claiming supplied-data coverage or role authorization. | `npm run check` passed: 27 tests, typecheck, lint, secret scan, zero audit vulnerabilities; CLI smoke imported one synthetic row and reported one unknown. | Fixture, role authorization and manual accessibility validation remain unavailable/unrun. |
