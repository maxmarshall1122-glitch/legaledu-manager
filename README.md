# LegalEdu Manager

Academic work management for a university law lecturer: students and groups,
six subject areas, assignments with rubrics, electronic submissions, grading
and feedback with revision tracking, teaching materials, reports/exports,
optional AI-assisted review (Anthropic Claude / Google Gemini), and a full
**Uzbek (default) / English** interface.

> **Two modes.** With Supabase configured, the app uses PostgreSQL, Supabase
> Auth and a private Storage bucket, protected by row-level security. Without
> it, the app runs in **demo mode**: fictional sample data in a local JSON file
> and a private local folder, with a banner on every page saying so. Demo mode
> is for evaluation only — it is not a production database.

## Quick start (demo mode, ~2 minutes)

Requirements: Node.js ≥ 20.9 (tested on 22), npm.

```bash
npm install
npm run dev            # http://localhost:3000
```

Sign in with a fictional account (password `demo-2026`, override with `DEMO_PASSWORD`):

| Account | Role |
|---|---|
| `lecturer@demo.legaledu.local` | Lecturer |
| `admin@demo.legaledu.local` | Administrator |
| `student1@demo.legaledu.local` | Student (group LAW-101) |
| `student2@demo.legaledu.local` | Student (group LAW-102) |

All people, records, texts and grades in demo mode are invented. Reset them
from **Settings → Reset demo data**, or `npm run demo:reset`.

## Features

| Area | What you can do |
|---|---|
| Dashboard | Live counts (students, groups, active assignments, submitted, awaiting review, revision, graded), average final score (approved grades only), upcoming deadlines, follow-ups; charts: workload by subject, submissions by status, grading progress (each with a data table). Shortcuts to create/upload/review. |
| Students | CRUD with confirmation, anonymised student IDs (unique, case-insensitive), groups, enrollment status, search/filter/sort/pagination, per-student progress. Deleting a student removes their submissions, grades and files. |
| Groups | CRUD, membership management, linked subjects. |
| Subjects | Six predefined (Cyber Law; English Language and Legal English; Judicial Power; Administrative Law; Financial Law; Criminal Law) plus custom; bilingual names/descriptions, assigned groups, assignments, materials and statistics. |
| Assignments | Draft → publish → archive; target groups, language (uz/en, independent of UI), type, issue date, deadline, max score, editable weighted rubric (default 25/20/20/15/10/10), reference materials, bilingual templates, student-view preview, per-student progress matrix. |
| Submissions | PDF/DOCX/PPTX/TXT, multiple files, server-side validation (extension, MIME, file signature, zip-bomb and macro checks, size/count limits), versioned resubmissions (earlier versions kept), late flag, safe preview (sandboxed PDF / extracted text), access-controlled downloads, follow-up notes. |
| Grading | Rubric scores with live, validated total; per-criterion comments; strengths, improvements, student feedback (bilingual templates); draft → approve / request revision with deadline; manual final override with mandatory reason; change approved grades with reason; full grade history + audit log. |
| AI review | Optional Claude/Gemini suggestion per submission, stored separately as a *pending suggestion*; copy into the form, edit, approve or reject. Never auto-grades, never shown to students, no plagiarism/AI-authorship verdicts. |
| Materials | Files or https links per subject/assignment; staff-only or student-visible. |
| Reports | Assignment register, submission status, outstanding work, grade summary, per-student progress, subject performance; filters by subject/group/assignment/status/date; CSV and Excel-compatible (UTF-8 BOM) exports with formula-injection protection. Missing data shows as “—”/empty, never 0. |
| Search | Global search across student IDs/names, assignments, subjects and filenames — limited to what the user may see. |
| Student portal | Published assignments for the student's groups, instructions, materials, upload/resubmit, own files, released feedback and approved scores only. |
| Settings | Language, theme, profile, backend/AI/upload status, privacy & retention info, audit log, demo reset. |

## Architecture

```
src/
  app/                 Next.js App Router pages, server actions, route handlers
    (app)/…            authenticated UI (staff pages + /my student portal)
    actions/           server actions → services (re-authenticate every call)
    api/files|materials|reports   access-controlled downloads and CSV export
  lib/
    services/          business rules + authorization (single source of truth)
    db/                Repo interface: SupabaseRepo (RLS) | MemoryRepo/FileRepo (tests/demo)
    storage/           FileStorage: Supabase private bucket | local private folder
    ai/                provider abstraction (Anthropic, Gemini) + prompts
    files/             upload validation and text extraction
    auth/              Supabase Auth / signed demo session
  i18n/                en.ts, uz.ts (type-checked parity), templates.ts
supabase/migrations/   schema, RLS, storage policies, reference data
tests/                 Vitest (services, security, i18n, CSV, AI) + tests/db (real PostgreSQL + RLS)
e2e/                   Playwright browser tests
scripts/               seed-supabase, retention, reset-demo
```

Every page, server action and route handler resolves the session on the
server and calls a service that authorizes the action. In Supabase mode the
database enforces row-level security as an independent second layer.

Stack: Next.js 16 · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Radix UI
primitives · React Hook Form + Zod 4 · Recharts 3 · Supabase (supabase-js 2,
@supabase/ssr) · @anthropic-ai/sdk · @google/genai · Vitest 5 · Playwright.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Develop / production build / serve |
| `npm run check` | Typecheck + lint + unit/integration tests |
| `npm test` | Vitest (includes PostgreSQL RLS tests when PostgreSQL is available) |
| `npm run test:e2e` | Production build + Playwright browser tests (demo mode, isolated data dir) |
| `npm run demo:reset` | Delete local demo data |
| `npm run seed:supabase -- --confirm-fictional` | Load fictional demo data into a *non-production* Supabase project |
| `npm run retention [-- --apply]` | Data-retention purge (dry run by default) |

## Documentation

- [docs/SUPABASE.md](docs/SUPABASE.md) — connecting Supabase (database, auth, storage, roles)
- [docs/AI-PROVIDERS.md](docs/AI-PROVIDERS.md) — configuring Claude and Gemini
- [docs/PRIVACY-AND-RETENTION.md](docs/PRIVACY-AND-RETENTION.md) — institutional privacy, retention and deletion
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — running locally and deploying securely
- [docs/TESTING.md](docs/TESTING.md) — test suites and latest results
- [docs/LIMITATIONS.md](docs/LIMITATIONS.md) — known limitations and unfinished integrations
- [.env.example](.env.example) — all environment variables (no secrets)
