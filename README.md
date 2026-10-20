# Team Standup Service

Local single-team written standups. React/Vite/TypeScript UI; Express/TypeScript API; SQLite (`better-sqlite3`); shared Zod validation. The configured team timezone defaults to `Asia/Kolkata`. The server binds to loopback by default and has no authentication: do not expose it to an untrusted network.

## Requirements

- Node.js 22+ (tested with Node 24.20.0)
- npm
- Windows/Linux/macOS local runtime supported in principle; this workspace was checked on Windows.

## Start and verify

From the repository root:

- `npm install` installs pinned lockfile dependencies.
- `npm run dev` starts API on `http://127.0.0.1:3000` and Vite on `http://127.0.0.1:5173`.
- `docker compose up --build` runs one loopback-bound application container with a persistent SQLite volume (requires Docker; this environment did not have a Docker CLI to validate the image).
- `npm run build` type-checks the backend/frontend and builds the production client.
- `npm run test` runs unit, integration and RTL tests.
- `npm run lint` runs ESLint.
- `npm run check` is the quality gate: tests, TypeScript, lint, secret scan and npm high-severity audit.
- `npm run seed` inserts a small number of synthetic example standups.
- `npm run perf` creates an isolated synthetic 20-member, 10,000-row/500-date SQLite dataset and measures five loopback HTTP requests each for dashboard and 30-day History, including response JSON consumption.

Persistent SQLite database: `server/data/standup.sqlite` (ignored by Git). Override with `DB_PATH`. Configure roster with `ROSTER_PATH` to a JSON array of stable `{id,displayName,role,active}` members, 1–50 entries; role is `member`, `lead`, or `support`. The default roster contains 10 synthetic members, including one lead and one support role. Roles are read-only metadata, not an authentication or authorization mechanism: every route is available to the trusted local operator. `TEAM_TIME_ZONE` defaults to `Asia/Kolkata`; `HOST` defaults to `127.0.0.1`; `PORT` defaults to 3000.

## API

Base `/api/v1`; JSON success `{success:true,data:{...}}`; errors `{success:false,error:{code,message}}`.

- `GET /health`
- `GET /members`
- `GET /standups?teamDate=YYYY-MM-DD&memberId=...`
- `GET /standups/:id`
- `POST /standups` with `{memberId,teamDate,tasks,blockers?}`; duplicate pair returns 409.
- `PUT /standups/:id` with replacement `{tasks,blockers?}`; creates before/after audit event.
- `GET /history?teamDate=YYYY-MM-DD&memberId=...` or bounded `from`/`to` range (max 30 calendar days).
- `GET /dashboard`
- `GET /export/YYYY-MM-DD` returns Markdown in the JSON envelope.

Writable dates are today and the previous working day in the team timezone. Saturday/Sunday are valid current days and both resolve their previous working day to Friday. History/export accept historical calendar dates.

## Correct a previous working day

On Today, find **Previous working day** and select **Edit standup** on a saved entry. The form selects that member/date, loads saved tasks/blockers and focuses tasks. Choose **Save changes**; the confirmation identifies the saved member/date and the form stays on that date. For a missing submission, select the member and previous working day in the form and submit. Saturday, Sunday and Monday all use Friday. The server rejects corrections after the date leaves the writable window. History is read-only and provides **Export selected day** for any calendar date, plus filters for retained inactive members.

## Legacy import

The command is `npm run import -- --file path-to-v1.json`. The current assumed envelope is `{"version":1,"standups":[...]}`. Each record can identify `memberId` or `memberName` and provide `teamDate` or `date`. Canonical `tasks` creates one entry for that date; split legacy `today` and `yesterday` text create separate entries for the explicit date and previous working day, respectively (Friday across weekends). Task text is split by lines. Optional `blockers` applies to today; `yesterdayBlockers` applies to the yesterday entry. This mapping is provisional because the official legacy fixture/schema is absent from the workspace. The importer never creates roster members, reports row outcomes, uses shared validation, treats markup as inert text, skips duplicate pairs (first valid record wins), recognizes identical file hashes and commits successful imports atomically. Unexpected transaction failures roll back all inserted rows and the import job. Supply and inspect the approved fixture before relying on v1 field mapping.

## Data, security and operations

Only synthetic data is included. User content is rendered as React text, Markdown output is escaped, SQL is parameterized, API responses use `Cache-Control: no-store` and do not return conditional 304 responses, and structured logs contain request metadata/correlation ID but not tasks, blockers, audit values, or request bodies. Audit rows do contain before/after standup content and share the local DB privacy boundary. No authentication/role-based authorization is implemented. Back up using SQLite's backup API or stop/checkpoint and safely copy the DB plus WAL files; verify restored health and counts.

The supplied migration/performance fixtures were not present at implementation time. Performance output from `npm run perf` is only a synthetic substitute and is not evidence for official DATA-01–DATA-08 supplied-case handling.
