/**
 * Data-retention purge (see docs/PRIVACY-AND-RETENTION.md).
 * Dry run by default; pass --apply to delete.
 *
 *   DATA_RETENTION_DAYS=730 npm run retention -- [--apply]
 *
 * Supabase mode needs SUPABASE_SERVICE_ROLE_KEY and RETENTION_ACTOR_ID (an
 * admin profile id recorded in the audit log). Demo mode works on .data/.
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { FileRepo } from "../src/lib/db/file-repo";
import { SupabaseRepo } from "../src/lib/db/supabase-repo";
import { purgeExpiredSubmissions } from "../src/lib/services/retention";
import type { Ctx } from "../src/lib/services/core";
import { LocalFileStorage, SupabaseFileStorage } from "../src/lib/storage/storage";

async function main() {
  const days = Number(process.env.DATA_RETENTION_DAYS);
  if (!Number.isInteger(days) || days < 1) throw new Error("Set DATA_RETENTION_DAYS to a positive number of days");
  const apply = process.argv.includes("--apply");
  let ctx: Ctx;
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const actor = process.env.RETENTION_ACTOR_ID;
    if (!actor) throw new Error("Set RETENTION_ACTOR_ID to an admin profile id");
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    ctx = { repo: new SupabaseRepo(admin), storage: new SupabaseFileStorage(admin), user: { id: actor, role: "admin", full_name: "retention", email: null, student_id: null }, locale: "en" };
  } else {
    const dir = path.resolve(process.env.DEMO_DATA_DIR || ".data");
    ctx = {
      repo: new FileRepo(path.join(dir, "demo-db.json")),
      storage: new LocalFileStorage(path.join(dir, "files")),
      user: { id: "00000000-0000-4000-8000-000000000001", role: "admin", full_name: "retention", email: null, student_id: null },
      locale: "en",
    };
  }
  const res = await purgeExpiredSubmissions(ctx, days, { dryRun: !apply });
  console.log(`${res.dryRun ? "[dry run] would delete" : "deleted"} ${res.submissions.length} submissions (${res.files} files) older than ${res.cutoff} on archived assignments`);
  if (res.submissions.length) console.log(res.submissions.join(", "));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
