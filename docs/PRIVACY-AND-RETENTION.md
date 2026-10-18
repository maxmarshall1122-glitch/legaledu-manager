# Privacy, data retention and deletion

This guide helps you configure LegalEdu Manager to meet your institution's
privacy and data-retention requirements. It is not legal advice — confirm the
settings with your data-protection officer (e.g. against Uzbekistan's Law on
Personal Data and your university's policies).

## What is stored

| Data | Purpose | Minimisation |
|---|---|---|
| Student ID (internal code), full name, optional institutional email, academic year, enrollment status, optional notes | Identify whose work is whose | Use anonymised codes (e.g. `LAW-24-0007`); email and notes are optional; notes field reminds staff to record only academically necessary information |
| Submissions and files (+ SHA-256 hash, upload time, version) | Assessment and evidence of submission | Private bucket, no public URLs |
| Reviews, rubric scores, feedback, grade history | Assessment record | Grade history is append-only |
| AI suggestions (incl. raw response) | Optional lecturer assistance | Staff-only; only anonymised text sent to providers |
| Audit log (actor, action, record id, small details) | Accountability for grade changes and file access | No document contents |
| Staff/student accounts (email, name, role, language) | Authentication | Managed by Supabase Auth |

## Access control

- Authentication is required for every page and API route.
- Authorization is checked on the server for every action, and enforced
  again by PostgreSQL row-level security and storage policies in production.
- Students can only see their own submissions, released feedback and
  approved final scores — never other students' work or grades, provisional
  scores, grade history or AI suggestions.
- Downloads go through an authorization check; in production the file is
  served via a 60-second signed URL of a private bucket. Access is audited.
- Unauthorized and non-existent records both return “not found”.

## Retention

1. Agree a retention period with your institution (for example, two years
   after the course ends).
2. Set `DATA_RETENTION_DAYS` (e.g. `730`). Settings → Privacy shows the value.
3. Archive assignments when the course ends.
4. Run the purge periodically (e.g. monthly cron on a trusted machine):

```bash
DATA_RETENTION_DAYS=730 npm run retention            # dry run: lists what would go
DATA_RETENTION_DAYS=730 npm run retention -- --apply # deletes
```

The purge deletes submissions on **archived** assignments whose last upload is
older than the period, together with their files, reviews, feedback and grade
history, and writes an audit entry. In Supabase mode it needs
`SUPABASE_SERVICE_ROLE_KEY` and `RETENTION_ACTOR_ID` (an admin profile id).

Also review:
- Supabase backups (point-in-time recovery keeps deleted data for the backup
  window) and log retention.
- AI provider data-retention settings if AI review is enabled.

## Deletion procedures

- **One student (e.g. erasure request):** Students → open the student → Delete.
  This permanently removes the record and, via cascading deletes, all of their
  submissions, files, reviews, feedback and grade history. The deletion is
  recorded in the audit log (code only).
- **Student portal account:** delete the auth user in Supabase
  (Authentication → Users). The student record stays (its `profile_id` is
  cleared) unless you also delete the student.
- **A submission or assignment:** delete it from its page (confirmation
  required); files are removed from storage.
- **Staff account:** delete the auth user; their name is removed from
  authorship columns (set to null) but grade history entries remain.

## Checklist before going live

- [ ] Public sign-ups disabled in Supabase Auth; MFA considered for staff
- [ ] Only the lecturer/admin have elevated roles
- [ ] `academic-files` bucket is private (migration sets `public = false`)
- [ ] Retention period agreed, `DATA_RETENTION_DAYS` set, purge scheduled
- [ ] AI providers approved by the institution (or keys left unset)
- [ ] HTTPS enforced by the hosting platform
- [ ] Service-role key stored only where scripts run, never in the web app
