# Testing and latest results

Run on 2026-10-18 in the build environment (Node 22, PostgreSQL 16, Chromium). These are the actual results of the final run, not estimates.

| Check | Command | Result |
|---|---|---|
| Type checking | `npm run typecheck` | ✅ 0 errors |
| Lint (eslint-config-next 16) | `npm run lint` | ✅ 0 errors, 0 warnings |
| Unit + integration + PostgreSQL RLS | `npm test` | ✅ 89 passed, 0 failed (11 files) |
| Production build | `npm run build` | ✅ succeeded, 0 warnings |
| Browser end-to-end (Playwright, Chromium, production server, demo mode) | `npm run test:e2e` | ✅ 7 passed, 0 failed |

## Coverage of the acceptance criteria

| Requirement | Where it is tested |
|---|---|
| Authentication & authorization | `auth.test.ts` (session signing/tampering/expiry; students blocked from every staff service), `db/schema-rls.test.ts`, e2e 1 & 5 |
| Creating and editing students | `students.test.ts`, e2e 3 |
| Creating assignments | `assignments.test.ts`, e2e 4 |
| Uploading and accessing authorized files | `files.test.ts`, e2e 5 |
| Preventing unauthorized file access | `files.test.ts` (other student → not found; staff-only materials), `db/schema-rls.test.ts` (storage policies) |
| Rubric totals | `grading.test.ts` (default, weighted, scaled) |
| Preventing invalid scores | `grading.test.ts`, `db/schema-rls.test.ts` (DB triggers), e2e 6 |
| Approving/changing grades with audit trail | `grading.test.ts`, e2e 6 |
| Student privacy boundaries | `files.test.ts`, `grading.test.ts`, `reports.test.ts` (search), `db/schema-rls.test.ts` |
| Uzbek and English localization | `i18n.test.ts` (key parity, placeholders, no missing keys in source), e2e 2 |
| Search and filtering | `students.test.ts`, `reports.test.ts`, e2e 3 |
| CSV export | `reports.test.ts` (formula injection, quoting, BOM, missing ≠ 0), e2e 7 |
| Missing AI credentials | `ai.test.ts`, e2e 6 (setup message shown) |

The PostgreSQL suite starts a temporary local cluster if PostgreSQL binaries are installed, or uses `TEST_DATABASE_URL` (as in `.github/workflows/ci.yml`). Without either, it is skipped — not faked.

Not tested here (no credentials available): live Supabase project, live Anthropic/Gemini calls. See [LIMITATIONS.md](LIMITATIONS.md).

## Unit / integration tests


**tests/files.test.ts**

- ✅ upload validation (server-side) > accepts genuine PDF, DOCX, PPTX and TXT
- ✅ upload validation (server-side) > rejects disallowed extensions, spoofed content, wrong MIME, empty and oversized files
- ✅ upload validation (server-side) > rejects macro-enabled documents disguised as .docx
- ✅ upload validation (server-side) > sanitizes path traversal and control characters from display names
- ✅ upload validation (server-side) > extracts text for safe previews
- ✅ storage keys > only server-generated keys are accepted (path traversal impossible)
- ✅ submissions > student uploads to an assignment for their group; resubmission preserves earlier versions
- ✅ submissions > revision request → resubmission flips status to resubmitted
- ✅ submissions > students cannot upload for others, to other groups' assignments, or after grading
- ✅ submissions > rejects too many files and invalid files without storing anything
- ✅ submissions > staff can upload on behalf of a student; late uploads are flagged
- ✅ file access control > owner and staff can read; other students get not-found; access is audited
- ✅ file access control > students see only their own submissions in lists
- ✅ file access control > students cannot download staff-only teaching materials

**tests/ai.test.ts**

- ✅ AI providers without credentials > are reported as not configured and return no client
- ✅ AI providers without credentials > requesting a review fails gracefully with a setup message and changes nothing
- ✅ AI providers without credentials > a configured key yields a provider without making any network call
- ✅ AI review workflow (fake provider) > stores a pending suggestion separate from the review, with a validated provisional total
- ✅ AI review workflow (fake provider) > students cannot request reviews or see suggestions
- ✅ AI review workflow (fake provider) > rejects malformed or out-of-range model output
- ✅ AI review workflow (fake provider) > maps provider failures (timeout, rate limit, auth) to safe messages
- ✅ AI review workflow (fake provider) > enforces a per-user daily limit
- ✅ AI review workflow (fake provider) > neutralises prompt-injection attempts that try to forge delimiter tags
- ✅ AI review workflow (fake provider) > lecturer can approve after editing (marked edited) or reject; student never sees AI data
- ✅ AI review workflow (fake provider) > truncates very long documents to the configured limit and records it

**tests/reports.test.ts**

- ✅ CSV export > neutralises spreadsheet formula injection
- ✅ CSV export > quotes, escapes, keeps missing values empty and adds a BOM for Excel
- ✅ CSV export > export cells distinguish missing (empty) from zero
- ✅ reports > every report type builds from stored data
- ✅ reports > grade summary shows missing final scores as null, not 0
- ✅ reports > filters by status, group and subject
- ✅ reports > subject report covers all six predefined subjects with null averages where nothing is graded
- ✅ global search and list filters > staff search spans students, assignments, subjects and filenames
- ✅ global search and list filters > student search never reveals other students or their files
- ✅ global search and list filters > assignment and submission filters

**tests/auth.test.ts**

- ✅ demo session tokens > round-trips a signed session
- ✅ demo session tokens > rejects tampered payloads, wrong secrets, garbage and expired tokens
- ✅ server-side authorization > students cannot call any staff service
- ✅ server-side authorization > lecturers and admins can use staff services

**tests/grading.test.ts**

- ✅ rubric totals > default rubric: total is the plain sum
- ✅ rubric totals > custom weights and maximums scale to the assignment maximum
- ✅ rubric totals > rejects out-of-range, negative, missing and non-numeric scores
- ✅ rubric totals > final score may not exceed the maximum
- ✅ grading workflow > saving a draft records the provisional score, moves to under review and keeps feedback unreleased
- ✅ grading workflow > prevents invalid scores on the server
- ✅ grading workflow > approving records final grade, history and audit; releases feedback; then requires a reason to change
- ✅ grading workflow > manual final override with a reason is kept separate from the calculated total
- ✅ grading workflow > revision requests release feedback to the student and set a future deadline

**tests/assignments.test.ts**

- ✅ assignments > creates a draft with default rubric (25/20/20/15/10/10) and a generated code
- ✅ assignments > publishing requires target groups and a deadline
- ✅ assignments > rejects deadline before issue date and empty rubric
- ✅ assignments > edits rubric criteria (add/update/remove) but refuses to remove scored criteria
- ✅ assignments > student view: only published assignments for the student's own groups
- ✅ assignments > student view hides staff-only materials

**tests/db/schema-rls.test.ts**

- ✅ Supabase schema + RLS on PostgreSQL > migrations create every table used by the app, with the six predefined subjects available as reference data
- ✅ Supabase schema + RLS on PostgreSQL > the fictional seed loads with all constraints satisfied (TS model ⇔ SQL schema)
- ✅ Supabase schema + RLS on PostgreSQL > new auth users always get the student role, regardless of client-supplied metadata
- ✅ Supabase schema + RLS on PostgreSQL > anonymous users cannot read any academic table
- ✅ Supabase schema + RLS on PostgreSQL > lecturer sees all records
- ✅ Supabase schema + RLS on PostgreSQL > a student sees only their own student record, submissions and files
- ✅ Supabase schema + RLS on PostgreSQL > a student never sees other students' grades, AI suggestions, rubric scores or grade history
- ✅ Supabase schema + RLS on PostgreSQL > a student sees only published assignments targeted at their groups, and no drafts
- ✅ Supabase schema + RLS on PostgreSQL > a student cannot submit on behalf of another student or tamper with lecturer fields
- ✅ Supabase schema + RLS on PostgreSQL > a student can create their own submission for a visible assignment (codes come from a sequence)
- ✅ Supabase schema + RLS on PostgreSQL > only an admin may change roles (no self-promotion)
- ✅ Supabase schema + RLS on PostgreSQL > grade history and audit logs are append-only
- ✅ Supabase schema + RLS on PostgreSQL > database rejects rubric scores above the criterion maximum and final scores above the assignment maximum
- ✅ Supabase schema + RLS on PostgreSQL > private storage: students can read only objects of their own submissions
- ✅ Supabase schema + RLS on PostgreSQL > deleting a student cascades to their submissions, reviews and grade history

**tests/students.test.ts**

- ✅ students > creates a student with group membership and an audit entry
- ✅ students > prevents duplicate student IDs (case-insensitive) on create and edit
- ✅ students > validates input on the server
- ✅ students > edits a student and replaces group memberships
- ✅ students > deleting a student removes their submissions, grades and stored files
- ✅ students > student profile lists progress across assignments
- ✅ search, filtering, sorting and pagination > filters by text, group, status and year
- ✅ search, filtering, sorting and pagination > sorts and paginates
- ✅ groups > manages members and rejects duplicate names

**tests/seed.test.ts**

- ✅ fictional demo seed > builds a consistent dataset through the real services
- ✅ fictional demo seed > dashboard figures are computed from records

**tests/retention.test.ts**

- ✅ data retention purge > dry run reports, real run deletes archived-assignment submissions and their files, and is audited
- ✅ data retention purge > keeps recent data and is staff-only

**tests/i18n.test.ts**

- ✅ Uzbek / English localization > both languages define exactly the same keys, none empty
- ✅ Uzbek / English localization > placeholders match between languages
- ✅ Uzbek / English localization > Uzbek strings are actually translated (not copied English) for user-facing labels
- ✅ Uzbek / English localization > every status, type and enum value has a label in both languages
- ✅ Uzbek / English localization > every literal translation key used in the source exists (no missing strings)
- ✅ Uzbek / English localization > translates with interpolation and falls back safely
- ✅ Uzbek / English localization > assignment and feedback templates exist in both languages

## End-to-end tests (Playwright)

- ✅ rejects wrong password and redirects anonymous users to login
- ✅ lecturer: Uzbek by default, every navigation item works, language persists
- ✅ lecturer: add a student, duplicate ID is rejected, search finds them
- ✅ lecturer: create and publish an assignment for LAW-101
- ✅ student: sees the assignment, uploads a file; cannot open staff pages
- ✅ lecturer: grades the submission with rubric, approves; student sees the final score
- ✅ reports export CSV and dark theme / mobile navigation work
