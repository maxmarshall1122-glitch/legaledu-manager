import "server-only";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { FileRepo } from "@/lib/db/file-repo";
import { SupabaseRepo } from "@/lib/db/supabase-repo";
import type { Repo } from "@/lib/db/repo";
import { buildDemoSeed } from "@/lib/demo/seed";
import { LocalFileStorage, SupabaseFileStorage, type FileStorage } from "@/lib/storage/storage";
import { appMode, configProblem } from "@/lib/config";
import { supabaseEnv } from "@/lib/env";

// ---------- Demo backend (local file + local private folder) ----------

interface DemoBackend {
  repo: FileRepo;
  storage: LocalFileStorage;
  secret: string;
}

const g = globalThis as unknown as { __legaleduDemo?: Promise<DemoBackend> };

function demoDir(): string {
  // Runtime-only location for demo data; excluded from build output tracing.
  // Serverless hosts (e.g. Vercel) have a read-only project directory: use the temp dir there.
  const fallback = process.env.VERCEL ? path.join(os.tmpdir(), "legaledu-demo") : path.join(process.cwd(), ".data");
  return path.resolve(/*turbopackIgnore: true*/ process.env.DEMO_DATA_DIR || fallback);
}

async function writeSeedFiles(storage: LocalFileStorage, files: Map<string, Uint8Array>) {
  for (const [key, bytes] of files) await storage.put(key, bytes);
}

async function initDemo(): Promise<DemoBackend> {
  const dir = demoDir();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const dbFile = path.join(dir, "demo-db.json");
  const storage = new LocalFileStorage(path.join(dir, "files"));
  let repo: FileRepo;
  if (fs.existsSync(dbFile)) {
    repo = new FileRepo(dbFile);
  } else {
    const seed = await buildDemoSeed();
    fs.rmSync(path.join(dir, "files"), { recursive: true, force: true });
    await writeSeedFiles(storage, seed.files);
    repo = new FileRepo(dbFile, seed.snapshot);
  }
  const secretFile = path.join(dir, "session-secret");
  let secret = process.env.DEMO_SESSION_SECRET ?? "";
  if (secret.length < 32) {
    if (!fs.existsSync(secretFile)) fs.writeFileSync(secretFile, randomBytes(32).toString("hex"), { mode: 0o600 });
    secret = fs.readFileSync(secretFile, "utf8").trim();
  }
  return { repo, storage, secret };
}

export function getDemoBackend(): Promise<DemoBackend> {
  if (configProblem()) return Promise.reject(new Error("Supabase configuration is invalid"));
  g.__legaleduDemo ??= initDemo();
  return g.__legaleduDemo;
}

/** Restores fictional seed data and deletes all demo uploads. Demo mode only. */
export async function resetDemoData(): Promise<void> {
  if (appMode() !== "demo") throw new Error("Not in demo mode");
  const demo = await getDemoBackend();
  const seed = await buildDemoSeed();
  fs.rmSync(path.join(demoDir(), "files"), { recursive: true, force: true });
  await writeSeedFiles(demo.storage, seed.files);
  demo.repo.reset(seed.snapshot);
}

// ---------- Supabase backend ----------

/** Supabase client bound to the signed-in user's session cookies (RLS applies). */
export async function supabaseServerClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  });
}

export async function getBackend(): Promise<{ repo: Repo; storage: FileStorage }> {
  // Never fall back to demo data when Supabase variables exist but are invalid.
  if (configProblem()) throw new Error("Supabase configuration is invalid");
  if (appMode() === "demo") {
    const d = await getDemoBackend();
    return { repo: d.repo, storage: d.storage };
  }
  const client = await supabaseServerClient();
  return { repo: new SupabaseRepo(client), storage: new SupabaseFileStorage(client) };
}
