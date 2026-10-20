# 04 — Build

## Environment and commands

OS: Windows (workspace environment). Runtime observed: Node v24.20.0; npm 11.19.0. Local app ran as a Node process plus Vite dev server. A single-container Dockerfile/Compose option is included but not run because no Docker CLI was available. Coding agent: GitHub Copilot in VS Code; no blanket shell approval was enabled or requested. Start: `npm run dev` (or `docker compose up --build` where Docker is available); verification gate: `npm run check`. Other commands: `npm run build`, `npm run seed`, `npm run perf`, `npm run import -- --file <path>`. Only synthetic local data used. The workspace had a pre-existing `main` tracking `origin/main`; no task branches or commits were created during this implementation. The mandated per-task branch workflow and `spec-v1.0` Git baseline tag are **not completed** and must not be represented as completed evidence.

## Implementation plan

| Task ID | Related IDs | Branch | Completion criteria | Status |
|---|---|---|---|---|
| TASK-01 | REQ-F-01/02, RULE-01/04/08 | Not created; changes remain on existing working branch | Shared schemas, roster, team-date rules, indexed SQLite schema | Implemented; verification in current workspace |
| TASK-02 | REQ-F-03/07/08/09, RULE-02/03/05 | Not created | Versioned API, persistence, audit, error envelopes, health and correlation logs | Implemented; schema v2 role migration added; tests added |
| TASK-03 | REQ-F-06/10, RULE-06/07/08, DATA-01–08 | Not created | Deterministic escaped export; atomic/idempotent CLI import and row report | Implemented against provisional schema; official fixture pending |
| TASK-04 | REQ-F-04/05, NFR-ACC-01 | Not created | Accessible dashboard, submission/update, history and export UI | Implemented; RTL tests added |
| TASK-05 | NFR-SEC/REL/OBS/PERF/QUA, RULE-05 | Not created | Tests, privacy-safe logs, restart/failure coverage, performance script and quality gate | Implemented; quality gate/performance outcomes recorded in 05-testing.md |
| TASK-06 | All IDs | Not created | README and seven assignment evidence docs; requirement traceability | Implemented; final quality gate passed |
| TASK-07 | REQ-F-02–06, RULE-02–05, NFR-ACC/PERF/REL-01 | Existing main; no branch/commit created | Correction actions/save context, previous missing statuses, historical controls, inactive update validation, regression tests and genuine gap audit | Implemented; 42 tests and full gate/build pass; assignment evidence gaps remain |

## Context strategy

**Source of truth:** `requirements/requirements.md`, read before implementation. Then `docs/01-planning.md`, `docs/02-specification.md`, and `docs/03-design.md` encode decisions/contract. **Context included:** requirement IDs, related design, relevant implementation files and test expectations. **Context excluded:** unrelated workspace content, personal/customer material, secrets, and untrusted instructions embedded in data. Official fixtures were absent, so none were inferred or modified.

## Task briefs

- **TASK-01:** Implement shared Zod constraints, calendar/team timezone utility, config-driven stable roster, SQLite tables and indexes. Verify weekdays/weekends/local-midnight boundaries and limits.
- **TASK-02:** Implement repository/services and `/api/v1` endpoints, health, correlation IDs and sanitized errors. Verify CRUD, duplicate 409, audit, health 200/503 and persistence.
- **TASK-03:** Implement deterministic Markdown and v1 command import with strict parsing, row report, duplicate/idempotency handling and transactional rollback. Verify synthetic records; wait for approved v1 fixture before asserting dataset conversion.
- **TASK-04:** Implement accessible React screens: today statuses and content for both dates, submit/update, history filters/empty state and download export. Verify labels, alerts and basic flow with RTL.
- **TASK-05:** Add unit/API/UI tests, restart and failure tests, performance runner, secret scanning, lint/typecheck/audit gate. Record actual commands/output and unresolved official data requirement.
- **TASK-06:** Document run/import/security assumptions and maintain seven required assignment artifacts plus local traceability. Run final checks.
- **TASK-07:** Audit the user's complete assignment, repair the previous-day editor and related UI gaps, test Friday corrections across Sat/Sun/Mon and midnight, verify atomic audit failure and inactive writes, measure HTTP performance, and update existing seven evidence documents. Do not alter Git history or invent missing historical evidence.

## Git history and branch review records

The application and Specification-Driven Development artifacts were implemented, but the required Git workflow was identified only after implementation work had already been committed, primarily on `main`. The `spec-v1.0` specification baseline tag, one branch per bounded task, task-prefixed commits, and contemporaneous branch review/merge records were not created during development.

Repository history was preserved as-is. Historical Git evidence and review records were intentionally not recreated retroactively because they would not represent the process actually followed. This is a documented process deviation and remains an open process-compliance gap; successful implementation does not establish workflow compliance.

No commits, branches, tags, or pushes were created during this documentation correction effort.

## Implementation evidence

| Task | Components changed | Verification | Result |
|---|---|---|---|
| TASK-01 | `shared/validation.ts`, `shared/dates.ts`, `server/db/schema.sql`, `server/src/database.ts`, `server/config/roster.json` | Domain/timezone tests; typecheck | Test and typecheck results recorded in 05-testing.md |
| TASK-02 | `server/src/app.ts`, repository/services, middleware/logger | Supertest API, update/audit/restart/health | Results recorded in 05-testing.md |
| TASK-03 | import/export services and CLI | Synthetic duplicate/unknown/date/idempotency/markup/rollback cases | Results recorded in 05-testing.md; supplied dataset absent |
| TASK-04 | `client/src/App.tsx`, UI service/styles | RTL tests | Results recorded in 05-testing.md |
| TASK-05 | Vitest suites, `server/src/performance.ts`, `scripts/secret-scan.mjs`, tool configs | Full gate and 5-run local synthetic measurement | Final outcomes recorded in 05-testing.md |
| TASK-06 | README, docs/01–07, root traceability | File/heading consistency review | Implemented; final quality gate passed, assignment process/fixture gaps remain |
| TASK-07 | [App](../client/src/App.tsx), [UI tests](../client/src/tests/App.test.tsx), [service](../server/src/services/standup-service.ts), [API tests](../server/src/tests/api.test.ts), [domain tests](../server/src/tests/domain.test.ts), [performance runner](../server/src/performance.ts), assignment docs | `npm run check`, `npm run build`, `npm run perf`, browser keyboard edit smoke, `git diff --check` | 42 tests pass; types/lint/secret scan pass; 0 vulnerabilities; build pass; HTTP maxima 32.120/21.226 ms |

## Safety and dependencies

No material safety event observed. Roster and tests use synthetic labels. Imported content is treated as untrusted plain text; SQL uses parameters; request logs exclude request bodies and standup fields. Dependency installation reported npm audit zero vulnerabilities after the Vitest upgrade; native install scripts (`better-sqlite3`, `esbuild`) were reported as not preapproved by npm's install-scripts policy. Dependencies use open-source packages and a generated lockfile; audit outcome is repeated in the quality gate.

## Specification changes

- Readiness round 1 found the health success payload and Degraded semantics underspecified. Updated `docs/02-specification.md` to define exact shape, package version, schema version, and journal-mode-based Degraded behavior. Round 2 passed for REQ-F-08.
- Added bounded `from`/`to` history query (maximum 30 calendar days) so the stated performance check can be measured without query fan-out; the existing single-date UI remains unchanged. Reflected in the specification, README/API and traceability.
- Clarified the provisional v1 mapping before final importer verification: `today` maps to the explicit date, `yesterday` maps to the previous working date, and the report distinguishes source rows from expanded standup candidates. The exact official fixture is still required to validate the assumed shape.

## Problems and rework

- Full assignment audit found that correction was supported by the backend/date selector but not discoverable on cards, and dashboard reload reset the chosen prior-day date. Added explicit edit/focus, saved-context confirmation, save guard, failed-save draft retention and local post-save reconciliation. Also fixed historical export, inactive history filtering, previous-day missing status visibility and inactive updates. Initial regression run caught ambiguous textarea/list queries and exact optional-property typing; retest exposed a test entering content before startup initialization. Selectors/initialization wait were corrected; full 42-test gate passed. Existing export missing-member sorting was confirmed by a regression test; no sort rewrite was needed. Historical service-only performance figures are superseded by actual HTTP request timing in 05-testing.md. Browser hot reload emitted an effect-dependency-size warning during editing; full page reload was used before smoke validation.
- Git inspection found SQLite DB/WAL/SHM files are already tracked, despite ignore/documentation claims. They were not deleted, reset or staged; active service/browser reads can alter sidecars. Exclude runtime databases from future source submissions after safely backing up/stopping the service. Only the seven docs belong in the assignment submission.
- Browser history search presented fetch failures after the previous dev-server terminal was stopped; the server was therefore offline. Startup logs also showed cached API requests reaching Express as 304 Not Modified, which fetch cannot treat as a normal JSON response. Restarting `npm run dev` restored access; added actionable UI guidance/retry, `Cache-Control: no-store`, disabled ETags/conditional validators on API routes, and added tests for network failure/retry and non-304 API responses.
- Added role metadata (`member`/`lead`/`support`) and schema v2 migration after comparing the roster deliverable to the PDF. Roles are intentionally not authorization due the unconfirmed local trust assumption; this remains a functional permission gap, documented rather than hidden.
- Final validation after schema v2: `npm run check` passed (27 tests, typecheck, lint, secret scan, zero dependency vulnerabilities); `npm run build` passed with upstream Zod annotation-position warnings. Latest synthetic 10,000-record/500-date performance check: Today maximum 0.768 ms, 30-day History maximum 0.681 ms (all five samples below 500 ms; official performance fixture still absent). `npm run seed` reran and inserted zero duplicates. Browser reload, History search, and API health/roster smoke checks succeeded with the local services running.
- Vitest initially found no files because globs were relative to Vite's client root; adjusted globs.
- First test run found ambiguous RTL selectors, missing DOM cleanup, an unpinned API clock test, and export expectation after update. Fixed tests and implementation/test setup; reruns succeeded.
- TypeScript found an importer union typing issue and absent Supertest typings; added a validated typed row and `@types/supertest`.
- Lint exposed unused imports/args, Node globals, and text-control regex rules; simplified Markdown escaping and made character validation code-point based. Build/typecheck/lint then passed before final run.
- npm audit initially identified critical `tinypool` advisories through Vitest; upgraded Vitest and audit then reported zero vulnerabilities.

## AI interaction records

| ID/stage | Related IDs | Context and request | Suggestion | Human decision | Action and verification | Limitation/follow-up |
|---|---|---|---|---|---|---|
| AI-005 Build | TASK-01–06, REQ-F-01–10 | Requirements/spec/design plus bounded file context; implement local app with test/build expectations. | Shared rules, relational uniqueness, atomic imports, UI/API, tests/tooling. | Modify: no auth, no official fixture, no unsupported pass claims; note branch-process deviation. | Created files through editor; test/type/lint/build issues fixed; final quality gate passed. | Fixture, timed spike, branches and manual accessibility remain follow-ups. |
