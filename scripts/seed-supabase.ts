/**
 * Loads the FICTIONAL demo dataset into a Supabase project (for evaluation /
 * staging only — never production). Requires the service-role key, which
 * bypasses RLS: run it from a trusted machine and never expose that key.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   DEMO_PASSWORD='choose-a-strong-one' npm run seed:supabase -- --confirm-fictional
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { buildDemoSeed, DEMO_ACCOUNTS } from "../src/lib/demo/seed";
import { STORAGE_BUCKET } from "../src/lib/storage/storage";
import type { TableName } from "../src/lib/types";

const LOAD_ORDER: TableName[] = [
  "groups", "students", "group_memberships", "subject_groups", "assignments", "assignment_groups", "rubric_criteria",
  "submissions", "submission_files", "ai_suggestions", "reviews", "rubric_scores", "feedback", "grade_history", "teaching_materials",
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  if (!process.argv.includes("--confirm-fictional")) throw new Error("Refusing to run without --confirm-fictional (this loads fictional demo data).");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { count } = await admin.from("students").select("id", { count: "exact", head: true });
  if (count && count > 0) throw new Error("The students table is not empty; refusing to mix fictional data with real records.");

  const password = process.env.DEMO_PASSWORD || randomBytes(12).toString("base64url");
  const { snapshot, files } = await buildDemoSeed();
  let json = JSON.stringify(snapshot);

  // 1) Fictional auth accounts → remap their fixed demo IDs to the real auth IDs.
  for (const acc of DEMO_ACCOUNTS) {
    const { data, error } = await admin.auth.admin.createUser({ email: acc.email, password, email_confirm: true, user_metadata: { full_name: acc.full_name } });
    if (error || !data.user) throw new Error(`createUser ${acc.email}: ${error?.message}`);
    json = json.split(acc.id).join(data.user.id);
    const { error: pe } = await admin.from("profiles").update({ role: acc.role, full_name: acc.full_name, locale: "uz" }).eq("id", data.user.id);
    if (pe) throw new Error(`profile ${acc.email}: ${pe.message}`);
  }
  // 2) Reuse the six predefined subjects created by the migration (match by code).
  const { data: subjects, error: se } = await admin.from("subjects").select("id, code");
  if (se) throw se;
  for (const s of snapshot.subjects) {
    const existing = subjects?.find((x) => x.code === s.code);
    if (existing) json = json.split(s.id).join(existing.id);
  }
  const data = JSON.parse(json) as typeof snapshot;

  // 3) Rows, in foreign-key order.
  for (const table of LOAD_ORDER) {
    const rows = data[table] as unknown[];
    for (let i = 0; i < rows.length; i += 200) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + 200) as never[]);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    console.log(`✓ ${table}: ${rows.length}`);
  }
  // 4) Files into the private bucket.
  for (const [k, bytes] of files) {
    const type = k.endsWith(".pdf") ? "application/pdf" : k.endsWith(".txt") ? "text/plain" : k.endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const { error } = await admin.storage.from(STORAGE_BUCKET).upload(k, bytes, { contentType: type, upsert: false });
    if (error) throw new Error(`upload ${k}: ${error.message}`);
  }
  console.log(`✓ files: ${files.size}`);
  console.log(`\nFictional accounts: ${DEMO_ACCOUNTS.map((a) => a.email).join(", ")}`);
  if (!process.env.DEMO_PASSWORD) console.log(`Generated password (shown once): ${password}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
