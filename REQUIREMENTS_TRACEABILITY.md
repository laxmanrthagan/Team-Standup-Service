# Requirements Traceability

Local working-repository traceability. Assignment submission remains the seven required Markdown files in `docs/`; this additional root file is retained with application code and must not be uploaded as an extra submission artifact. Tests described here are implemented in source; only statuses supported by actual runs are stated. Official fixture cases remain pending because fixtures were not in the workspace.

| Requirement | Design | API | Database | Test/evidence |
|---|---|---|---|---|
| REQ-F-01 Roster | Config-loaded stable IDs, role metadata, active/inactive history | `GET /api/v1/members`; no CRUD | `members` stable PK, role and active flag (schema v2) | `server/config/roster.json`; `TEST-13`; role-based authorization explicitly not implemented under DEC-01 |
| REQ-F-02 Submit | Shared schema + service | `POST /api/v1/standups` | `standups` row with unique member/date | TEST-04/05 |
| REQ-F-03 Update | Replace service + audit transaction | `PUT /api/v1/standups/:id` | Update row + `audit_events` before/after | TEST-04/08 |
| REQ-F-04 Today | Timezone dashboard, active members submitted/missing and both content panels | `GET /api/v1/dashboard` | Indexed `standups(team_date,member_id)`, `members` | TEST-03/10; UI verifies content for both dates |
| REQ-F-05 History | Date/member filter, empty state, bounded 30-day query | `GET /api/v1/history` | Date/member indexes | TEST-07/10 |
| REQ-F-06 Export | Stable sort + escaped Markdown | `GET /api/v1/export/:date` | Roster/standups lookup | TEST-05/09 |
| REQ-F-07 API | JSON envelope + domain errors; non-cacheable JSON reads | `/api/v1` read/create/update endpoints | Repository tables | TEST-05/06/07/15 |
| REQ-F-08 Health | SQLite probe and status classification | `GET /api/v1/health` | SQLite PRAGMA / `user_version` | TEST-06 200 and 503 |
| REQ-F-09 Persistence | SQLite durable DB, shutdown close | Read/write API | members, standups, audit | TEST-08 close/reopen |
| REQ-F-10 Import | Strict v1 parser, today/yesterday date expansion, shared validation, duplicate reporting, one transaction | Command `npm run import -- --file`; no import HTTP endpoint per source spec | `import_jobs.file_sha256` UNIQUE; standups unique key | TEST-09/12 synthetic only; official DATA results pending |
| RULE-01 Team timezone/UTC | IANA team date; UTC event stamps | Create/update service | UTC timestamps distinct from `team_date` | TEST-02/03 |
| RULE-02 One/writable window | Local today/previous workday | POST/PUT validate; POST duplicate 409 | UNIQUE(member_id,team_date) | TEST-03/04/09 |
| RULE-03 Stable identity | Name/role separate from ID; inactive retained | Members read | `members.id` FK; schema-v2 role field | Config/schema; rename/removal test pending |
| RULE-04 Invalid inputs | Shared Zod rules | POST/PUT/query validation | constraints/FKs | TEST-01/04/09 |
| RULE-05 Midnight | Team-local date, weekend-aware prior day | Write window | `team_date` caller value | TEST-02/03 |
| RULE-06 Deterministic export | Name/ID sort, stable task order, escaping | Export route | Ordered reads | TEST-05/09/11; byte-for-byte repeat assertion |
| RULE-07 Import mapping/idempotency | Historical v1 today/yesterday conversion, name lookup, file hash | CLI import report | import hash unique + standup pair unique | TEST-09/12 synthetic; official fixture pending |
| RULE-08 Shared validation | Shared schemas for API/import; UI same fields/business service | API and UI | Validated values stored | TEST-01/09 |
| NFR-SEC-01 Security | Strict validation, text rendering, output escaping, parameterized SQL, no-store API responses | JSON limit and errors | Prepared statements | TEST-01/05/09/11/15; manual security review pending |
| NFR-PERF-01 Performance | Indexed queries; max 30-date history | Dashboard/history | date/member indexes | `npm run perf` five samples per operation, synthetic substitute only |
| NFR-REL-01 Reliability | Transactional imports and durable file | Service operations | SQLite transaction/constraints | TEST-08/09 |
| NFR-OBS-01 Observability | Structured event logger/correlation middleware, content omitted | Correlation response header | No content logging | TEST-05/06/11; captured log assertion |
| NFR-ACC-01 Accessibility | Semantic forms, labels, alerts, focus states, actionable/retryable fetch errors | UI | N/A | TEST-10/14 automated; manual keyboard/screen-reader pending |
| NFR-MNT-01 Maintainability | Shared domain services independently callable | API and importer share domain | Repository abstraction | Domain tests TEST-01–04/09 without browser |
| NFR-PRI-01 Privacy | Synthetic only; local trust boundary | Loopback default/no auth | Audit contains private content | Source review + tests; external fixture privacy check pending |
| NFR-QUA-01 Quality gate | npm script runs test/type/lint/secret/audit | N/A | N/A | `npm run check` passed: 27 tests, typecheck/lint/secret scan, zero vulnerabilities |
| DATA-01–08 | Mapping, today/yesterday expansion, first-valid and existing-conflict rules | CLI output report | Unique constraints/hash | TEST-09/12 synthetic analogues; supplied cases untested |
