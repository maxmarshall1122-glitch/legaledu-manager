# Known limitations and unfinished integrations

Stated plainly so nothing is mistaken for a capability that was not verified.

## Not verified against live external services

- **Supabase**: no project credentials were available. The SQL migrations,
  RLS and storage policies were run against PostgreSQL 16 with stand-ins for
  Supabase's `auth`/`storage` schemas (15 automated tests). The
  `SupabaseRepo`, `SupabaseFileStorage`, Supabase sign-in flow, session
  refresh in `proxy.ts` and `scripts/seed-supabase.ts` compile and follow the
  documented supabase-js / @supabase/ssr APIs, but have **not** been run
  against a real project. Test on a staging project first.
- **Claude / Gemini**: no API keys were available; no live AI calls were made.
  The workflow (authorization, extraction, prompt, validation, storage,
  approve/reject, error mapping, limits) is tested with a fake provider.
  `GEMINI_MODEL` defaults to `gemini-2.5-pro`; set it to a model your account
  offers.

## Functional limitations

- **No email or external notifications.** Publishing an assignment makes it
  visible in the student portal only; nothing is emailed.
- **Single-lecturer authorization model.** All staff (lecturer/admin) can
  access all academic records. Per-lecturer ownership of subjects is not
  implemented (would require an owner column and narrower RLS policies).
- **Students submit one submission per assignment** (with any number of
  versions and up to `MAX_FILES_PER_SUBMISSION` files per version). Group
  submissions are not supported.
- **Students may replace work while status is “Submitted”** and after a
  revision request; once review starts they cannot.
- **Preview** shows PDFs in the browser viewer and DOCX/PPTX/TXT as extracted
  plain text (formatting, images and tables are not rendered). Scanned PDFs
  without a text layer have no text preview and can't be AI-reviewed (no OCR).
- **Excel export** is a UTF-8-BOM CSV that Excel opens correctly; native
  `.xlsx` is not produced.
- **Rate limiting** is in-memory per server instance.
- **Demo mode** stores data in a JSON file without cross-process locking; run
  a single instance.
- **Accessibility**: semantic structure, labels, focus states, keyboard
  dialogs (Radix), chart data tables and contrast-checked chart colors are in
  place; no formal WCAG audit or screen-reader testing was performed.
- **Translations**: Uzbek (Latin script) strings were written for this build
  and should be reviewed by a native speaker for institutional terminology.
  Cyrillic Uzbek is not provided.
- A student who is redirected away from a staff page receives an HTTP 200
  with a client-side redirect (Next.js streaming behaviour) rather than a 307;
  no staff data is rendered.

## Dependency audit

`npm audit` reports advisories in transitive dependencies (`braces`,
`sprintf-js`) pulled in by tooling and document-parsing libraries. They are
not reachable with user-controlled input in this app's code paths, but review
and update dependencies regularly.
