# Connecting Supabase

Supabase provides the production database (PostgreSQL), authentication and
private file storage. When `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are set, the app switches from demo mode to
Supabase automatically (Settings → System status shows which is active).

## 1. Create the project

1. Create a project at <https://supabase.com> (choose a region that satisfies
   your institution's data-residency rules).
2. **Authentication → Providers**: keep *Email* enabled. Turn **off** public
   sign-ups (*Allow new users to sign up*) — accounts are created by an
   administrator. Consider enforcing MFA for staff.
3. **Authentication → URL configuration**: set the Site URL to your deployment URL.

## 2. Apply the migrations

With the Supabase CLI (recommended):

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push          # applies supabase/migrations/*.sql in order
```

Or paste each file from `supabase/migrations/` into the SQL editor, in filename order:

| File | Contents |
|---|---|
| `…0001_schema.sql` | Tables, keys, constraints, indexes, `updated_at` triggers, score-range triggers, append-only grade history/audit log, code sequences, profile creation on sign-up |
| `…0002_rls.sql` | Row-level security for every table, role helpers, role-change protection, student update guard |
| `…0003_storage.sql` | Private bucket `academic-files` (type/size limits) and storage policies |
| `…0004_reference_data.sql` | The six predefined subjects |

These migrations are exercised against PostgreSQL 16 by `tests/db/schema-rls.test.ts`
using stand-ins for Supabase's `auth` and `storage` schemas. They have **not**
been applied to a live Supabase project as part of this build; run them on a
staging project first.

## 3. Configure the app

```bash
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/publishable key>
```

The web app only uses the anon key with the signed-in user's session, so every
query is filtered by RLS. The service-role key is used **only** by offline scripts.

## 4. Create users and assign roles

New auth users always get the `student` role (client-supplied metadata is
ignored). To create the lecturer:

1. **Authentication → Users → Add user** (email + password, confirm email).
2. In the SQL editor:

```sql
update public.profiles set role = 'lecturer', full_name = 'Dr. …' where email = 'lecturer@your-university.uz';
-- optional administrator
update public.profiles set role = 'admin' where email = 'it-admin@your-university.uz';
```

Only an admin (or SQL run by the project owner) can change roles; users cannot
promote themselves.

### Student portal accounts (optional)

Students do not need accounts for the lecturer to manage their work. To let a
student sign in and submit online: create their auth user, then link it to the
student record:

```sql
update public.students set profile_id = (select id from public.profiles where email = 'student@your-university.uz')
where student_code = 'LAW-24-0007';
```

## 5. Optional: fictional demo data on a staging project

```bash
NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DEMO_PASSWORD='…' \
  npm run seed:supabase -- --confirm-fictional
```

The script refuses to run if the `students` table already contains records.
Note: it has been type-checked but not run against a live project during this build.

## Security model summary

| Data | Lecturer/Admin | Student |
|---|---|---|
| Students, groups, memberships | all | own record / own groups |
| Subjects | all | read |
| Assignments, rubric | all | published + targeted at their group |
| Submissions, files | all | own only; may create/resubmit, cannot change lecturer fields |
| Reviews, feedback | all | own, only after release (approval or revision request) |
| Rubric scores, grade history, AI suggestions | all (history append-only) | none |
| Teaching materials | all | visible ones for their subjects/assignments |
| Audit log | read; insert own | insert own (e.g. uploads) |
| Storage objects | all | own submission folders; visible materials |
