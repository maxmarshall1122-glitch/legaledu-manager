import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";

/**
 * Throwaway PostgreSQL for schema/RLS tests.
 * - TEST_DATABASE_URL: use an existing empty database (e.g. CI service container).
 * - Otherwise: initdb a temporary local cluster if PostgreSQL binaries are installed.
 * Returns null when neither is available (tests are then skipped, not faked).
 */
export interface Harness {
  client: pg.Client;
  stop: () => Promise<void>;
}

function findBin(): string | null {
  const root = "/usr/lib/postgresql";
  if (!fs.existsSync(root)) return null;
  const versions = fs.readdirSync(root).sort((a, b) => Number(b) - Number(a));
  for (const v of versions) {
    const bin = path.join(root, v, "bin");
    if (fs.existsSync(path.join(bin, "initdb"))) return bin;
  }
  return null;
}

export async function startPostgres(): Promise<Harness | null> {
  if (process.env.TEST_DATABASE_URL) {
    const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await client.connect();
    return { client, stop: () => client.end() };
  }
  const bin = findBin();
  if (!bin) return null;
  const isRoot = process.getuid?.() === 0;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "legaledu-pg-"));
  fs.chmodSync(dir, 0o755);
  const run = (cmd: string, args: string[]) => {
    const full = isRoot ? ["-u", "postgres", "--", path.join(bin, cmd), ...args] : args;
    const res = spawnSync(isRoot ? "runuser" : path.join(bin, cmd), full, { encoding: "utf8" });
    if (res.status !== 0) throw new Error(`${cmd} failed: ${res.stderr}`);
  };
  if (isRoot) execFileSync("chown", ["postgres", dir]);
  const data = path.join(dir, "data");
  run("initdb", ["-D", data, "-A", "trust", "-U", "postgres", "--no-sync"]);
  const port = 20000 + Math.floor(Math.random() * 20000);
  run("pg_ctl", ["-D", data, "-l", path.join(dir, "log"), "-w", "-o", `-p ${port} -k ${dir} -c listen_addresses='' -c fsync=off`, "start"]);
  const client = new pg.Client({ host: dir, port, user: "postgres", database: "postgres" });
  await client.connect();
  return {
    client,
    stop: async () => {
      await client.end();
      try {
        run("pg_ctl", ["-D", data, "-m", "immediate", "stop"]);
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    },
  };
}

/** Minimal stand-ins for the Supabase-managed `auth` and `storage` schemas and roles. */
export const SUPABASE_STUBS = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
create or replace function auth.uid() returns uuid language sql stable as
  $f$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text,
  owner uuid, owner_id text, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
`;
