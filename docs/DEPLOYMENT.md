# Running locally and deploying securely

## Local development

```bash
npm install
npm run dev                 # demo mode (fictional data) unless Supabase vars are set
```

To develop against Supabase, create `.env.local` from `.env.example` and fill
`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (see
[SUPABASE.md](SUPABASE.md)). A local Supabase stack (`npx supabase start`,
requires Docker) works the same way with `npx supabase db reset` to apply the migrations.

Quality gate before committing: `npm run check` (typecheck, lint, tests) and
`npm run test:e2e`.

## Production deployment

The app is a standard Next.js 16 server application (`npm run build && npm start`,
Node ≥ 20.9). It runs on Vercel, a container platform, or a VM behind a reverse proxy.

1. **Supabase**: apply migrations and create staff accounts ([SUPABASE.md](SUPABASE.md)).
2. **Environment** (host secret store, never in the repo):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required for production.
   - `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` — optional.
   - `MAX_UPLOAD_MB`, `MAX_FILES_PER_SUBMISSION` — set **before `npm run build`**,
     because the server-action body limit is derived from them at build time.
   - Do **not** set `SUPABASE_SERVICE_ROLE_KEY` on the web host; the app does not need it.
3. **HTTPS only.** Session cookies are `Secure` in production.
4. **Never run production in demo mode.** Without Supabase variables the app
   uses local fictional data; the yellow banner makes this obvious. Demo data
   in `.data/` is not backed up, encrypted or shared between instances.
5. **Rate limiting** in the app is in-memory per instance (login, uploads,
   downloads, exports, AI). With several instances, add a shared limit at the
   edge (platform WAF/firewall rules) as well.
6. **Upload limits**: Supabase bucket limit is 50 MB/object; platform request
   limits (e.g. serverless body size caps) may be lower than
   `MAX_UPLOAD_MB × MAX_FILES_PER_SUBMISSION` — check your host's limits.
7. **Headers**: the app sets `X-Content-Type-Options`, `X-Frame-Options:
   SAMEORIGIN`, `Referrer-Policy`, `Permissions-Policy`; downloads are served
   with a sandboxing CSP and `Content-Disposition: attachment` (PDF preview is
   the only inline type).
8. **Backups & monitoring**: enable Supabase backups / PITR; monitor auth
   logs; review the in-app audit log (Settings).

## Updating

`git pull && npm ci && npx supabase db push && npm run build && npm start`.
Add schema changes as new files in `supabase/migrations/` (never edit applied
migrations), keep `src/lib/types.ts` and `src/lib/db/schema-meta.ts` in sync,
and run `npm test` — the PostgreSQL test loads the seed into the real schema
and fails if the TypeScript model and SQL diverge.
