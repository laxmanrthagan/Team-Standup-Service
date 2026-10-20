# AI-Augmented Software Engineering - A Hands-On Journey Across the SDLC
## Assignment 2 - Specification Driven Team Standup Service

| Target Competency | Duration | Primary Tool | Submission |
|-------------------|----------|-------------|------------|
| Specification driven development | 1 week | Copilot | Seven Markdown files in docs only |

---

# Purpose

Build a locally runnable Team Standup Service by starting from these specifications and using AI throughout the SDLC.

The assignment assesses how well you:
- Clarify requirements
- Make evidence-based decisions
- Control coding-agent work
- Verify the result

The application matters, but reviewers will assess the quality and consistency of the evidence in your seven Markdown files.

Code is retained locally and is not submitted.

---

# What You Must Do

| Step | Action | Main Evidence |
|------|---------|--------------|
| 1 | Understand the product and resolve the nine open decisions. | 01-planning.md |
| 2 | Investigate one material uncertainty for 30 to 60 minutes. | 01-planning.md |
| 3 | Write an implementation-ready specification and test it with a fresh agent. | 02-specification.md |
| 4 | Design the solution and divide delivery into at least six bounded tasks. | 03-design.md and 04-build.md |
| 5 | Implement one task at a time using controlled agent context and Git branches. | 04-build.md |
| 6 | Test the requirements, review findings and verify fixes. | 05-testing.md and 06-review.md |
| 7 | Reflect on human decisions, rework and lessons. | 07-reflection.md |

---

# What You Submit

- Submit only the docs folder containing the seven required Markdown files and demo video link.
- Do not submit application code.
- Keep the local working repository and runnable environment until the program confirms that review is complete.

---

# Where Do You Submit

- First, create an Assignment-2 folder in your respective GitLab repository.
- Inside Assignment-2, create a docs folder.
- Submit your assignment only in the docs folder.

---

# Important Points

## Keep Files in Sync

You write these files as you work, so later phases will change earlier decisions. When that happens:

- Update the earlier file so it reflects your final position, for example a changed data model goes back into 02-design.md.
- Record what changed and why in the phase where the change came up, such as Implementation Plan vs. Actual in 03-build.md or Findings in 05-review.md.
- Never leave two files disagreeing about the same decision, data model, or requirement status.

## Confidentiality, Data & Licensing

Treat everything you submit as material that will be read outside your team.

- No personal data. Use synthetic test data only.
- No real names, emails, phone numbers, addresses, or account details in examples, test data, screenshots, or logs.
- Redact anything personal that appears in a screenshot.
- No client or employer material.
- No client code, client names, internal URLs, internal system names, proprietary data, or copied internal documentation.
- No secrets.
- No API keys, tokens, passwords, or connection strings in text, screenshots, or logs.
- Properly licensed tools only.
- Prefer open-source or free-to-use tools, libraries, and plugins.
- Never use a paid tool without a valid license for this use.
- No copied proprietary code.
- If an AI suggestion appears to reproduce licensed or proprietary code, do not use it. Ask for an original implementation instead.

---

# 1. Product Definition

## A Typical Day

A delivery team of about 20 people uses written standup. Each member records a short task list and optional blockers for an explicit team date.

By mid-morning:
- Members record today's tasks.
- Members may correct the previous working day.
- On Monday this means Friday and Monday.

The team lead:
- Checks missing submissions.
- Reviews blockers.
- Exports one day as Markdown.

Some members travel, so one configured team timezone determines the team date.

Support staff need health and failure information without exposing standup text.

## Fixed Scope

- One team per deployment.
- Roster loaded from configuration at startup.
- Roster contains 1 to 50 members.
- No roster-management UI or API.
- One entry exists per member per team date.
- Entry contains task list and optional blockers.
- Caller always supplies the team date.
- Writes accepted for:
  - Current team date
  - Previous working day only
- Weekend rule:
  - Saturday and Sunday are valid current team dates.
  - Previous working day is Friday.
  - Design must state how weekend dates appear on Today and History.
- One configured team timezone determines current date and writable window.
- Store timestamps in UTC.
- Daylight-saving zones are out of scope.
- Browser UI, JSON API and importer reuse the same field, content and business validation where applicable.
- Historical importer may write older dates.
- Writable-window restriction applies only to UI and API writes.
- Run locally with one application container and one SQLite database.

## Interfaces

| Interface | Required Capability |
|------------|-------------------|
| Browser UI | Submit/update, Today dashboard, History, export one day |
| JSON HTTP API | Read, submit, update standups, export, health check |
| Import command | Convert supplied v1 JSON export format |

## Data and Reference Size

Nagarro provides the complete synthetic dataset required for migration testing.

Includes:
- Valid records
- Duplicates
- Invalid dates
- Unknown members
- Missing fields
- Conflicting legacy data
- Markup-like text

Do not modify the supplied dataset for mandatory tests.

Specify how each case should be handled, run the importer and record the actual result for every supplied case.

### Datasets

| Dataset | Provided Content | Required Use |
|----------|----------------|--------------|
| Functional roster | 10 fictional members | UI, API and permission testing |
| Legacy migration data | Two working weeks plus invalid/conflicting records | Import testing |
| Performance roster | 20 fictional members | Performance testing |
| Performance standups | 10,000 valid records covering 500 team dates | Performance testing |

### Migration Cases

| Case | Supplied Condition | What To Demonstrate |
|--------|-------------------|---------------------|
| DATA-01 | Valid record | Imported correctly |
| DATA-02 | Duplicate member and date | Duplicate policy applied |
| DATA-03 | Invalid date | Validation behavior applied |
| DATA-04 | Unknown member | Reported without creating member |
| DATA-05 | Missing required field | Rejected or handled by spec |
| DATA-06 | Markup-like content | Stored, displayed and exported safely |
| DATA-07 | Existing record already exists | Conflict policy applied |
| DATA-08 | Same file imported twice | No additional standups created |

---

# 2. Users and Functional Requirements

## Users

| User | Need |
|--------|-------|
| Team member | Record or correct tasks for today and previous working day |
| Team lead | See submitted and missing members, review history and export |
| Support/developer | Diagnose failures without exposing standup text |

## Functional Requirements

| ID | Area | Requirement |
|----|------|-------------|
| REQ-F-01 | Roster | Load stable member IDs and display names from config |
| REQ-F-02 | Submit | Record tasks and blockers through UI and API |
| REQ-F-03 | Update | Replace entry and create audit event |
| REQ-F-04 | Today | Show Submitted/Missing members and content |
| REQ-F-05 | History | Browse by date, filter by member and show empty state |
| REQ-F-06 | Export | Deterministic Markdown export including submitted and missing members |
| REQ-F-07 | API | Read/create/update endpoints with consistent JSON responses |
| REQ-F-08 | Health | Healthy response and storage-unavailable response |
| REQ-F-09 | Persistence | Preserve standups and audit events across restarts |
| REQ-F-10 | Legacy Import | Convert v1 JSON, prevent duplicates, support rollback |

## Team Date and Timezone

Configured team timezone:

**Asia/Kolkata**

Rules:

- Individual member timezones are not collected or used.
- Current team date is calculated using configured timezone.
- UI/API accept entries only for:
  - Current team date
  - Previous working day
- Store creation/update timestamps in UTC.
- Never use UTC timestamps to determine team_date.

---

# 3. Business Rules and Decisions

## Business Rules

| ID | Rule |
|-----|------|
| RULE-01 | Team timezone determines current team date and writable window |
| RULE-02 | One entry per member per team date |
| RULE-03 | Stable member ID preserves history |
| RULE-04 | Reject unknown members, malformed dates, missing fields, invalid values |
| RULE-05 | Test writable window around local midnight |
| RULE-06 | Export ordering must be deterministic |
| RULE-07 | Importer maps names, handles historical dates and is idempotent |
| RULE-08 | UI/API/importer share validation rules |

## Nine Decisions You Must Resolve

| Topic | Decision Required |
|---------|------------------|
| Identity and permissions | Caller identity, permissions and trust model |
| Weekend display and holidays | Weekend appearance and holiday handling |
| Create versus update | POST behavior on existing record |
| Audit content | Timestamp only or full before/after content |
| Import duplicates | What counts as duplicate and winner rule |
| v1 conversion | Legacy mapping strategy |
| Roster changes | Removed/renamed member handling |
| Concurrent updates | Conflict strategy |
| Content limits | Lengths, limits, Markdown policy, blockers |

---

# 4. Quality and Technical Constraints

## Non-Functional Requirements

| ID | Area | Required Outcome |
|-----|------|-----------------|
| NFR-SEC-01 | Security | Validate and safely render all input |
| NFR-PERF-01 | Performance | Measure Today and History performance |
| NFR-REL-01 | Reliability | Preserve data and avoid partial imports |
| NFR-OBS-01 | Observability | Safe logging without exposing standup content |
| NFR-ACC-01 | Accessibility | Keyboard operability and validation clarity |
| NFR-MNT-01 | Maintainability | Shared rules and testability |
| NFR-PRI-01 | Privacy | Synthetic data only |
| NFR-QUA-01 | Quality Gate | Tests, lint, secret scan and dependency scan |

## Technical Constraints

- Locally runnable application
- SQLite database
- Persist data across restarts
- No paid services
- No cloud deployment required
- One command to start
- One command to run checks
- Licensed tools and dependencies only

---

# 5. Required Working Method

## Step 1 Clarify and Specify
Define actors, glossary, scope, requirements, assumptions, risks, questions and acceptance criteria.

## Step 2 Investigate One Uncertainty
Run a 30–60 minute technical spike.

## Step 3 Test Whether Specification Is Ready
Use a fresh agent session and verify specification readiness.

## Step 4 Design and Plan
Create architecture, API contracts, validation and task breakdown.

## Step 5 Implement Incrementally
One bounded task at a time with controlled context.

## Step 6 Test and Review
Run normal, negative, boundary, migration, restart and failure testing.

## Step 7 Reflect
Document human decisions, AI impact and lessons learned.

---

# 6. Git, AI Use and Safety

## Working Repository and Submission

- One local repository.
- First commit = specification baseline.
- Tag baseline as `spec-v1.0`.
- Use one branch per task.
- Prefix commits with task ID.
- Review before merge.
- Upload docs only.

## Minimum Branch Review Record

| Field | Record |
|---------|---------|
| Task and branch | TASK-nn / task branch |
| Changes | Files and reasons |
| Review | Diff observations |
| Verification | Commands/checks run |
| Decision | Merge, rework or reject