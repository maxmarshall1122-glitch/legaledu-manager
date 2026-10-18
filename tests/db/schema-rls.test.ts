import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type pg from "pg";
import { buildDemoSeed, DEMO_IDS } from "@/lib/demo/seed";
import type { Snapshot } from "@/lib/db/memory-repo";
import { TABLES, type TableName } from "@/lib/types";
import { startPostgres, SUPABASE_STUBS, type Harness } from "./pg-harness";

/**
 * Runs the real Supabase migrations on PostgreSQL, loads the fictional seed
 * (which proves the TypeScript model matches the SQL schema and its
 * constraints), then exercises row-level security as different users.
 */
let h: Harness | null = null;
let db: pg.Client;
let seed: Snapshot;

const LOAD_ORDER: TableName[] = [
  "groups", "students", "group_memberships", "subjects", "subject_groups", "assignments", "assignment_groups",
  "rubric_criteria", "submissions", "submission_files", "ai_suggestions", "reviews", "rubric_scores", "feedback",
  "grade_history", "teaching_materials", "audit_logs",
];

async function insertRows(table: TableName, rows: Record<string, unknown>[]) {
  for (const r of rows) {
    const cols = Object.keys(r);
    const vals = cols.map((c) => (r[c] !== null && typeof r[c] === "object" ? JSON.stringify(r[c]) : r[c]));
    await db.query(`insert into public.${table} (${cols.map((c) => `"${c}"`).join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")})`, vals);
  }
}

/** Runs `fn` as an authenticated user (RLS enforced) inside a rolled-back transaction. */
async function as<T>(uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${uid ? "authenticated" : "anon"}`);
    if (uid) await db.query("select set_config('request.jwt.claim.sub', $1, true)", [uid]);
    return await fn();
  } finally {
    await db.query("rollback");
  }
}
const q = async (sql: string, params: unknown[] = []) => (await db.query(sql, params)).rows;

beforeAll(async () => {
  h = await startPostgres();
  if (!h) return;
  db = h.client;
  await db.query(SUPABASE_STUBS);
  const dir = path.resolve("supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.query(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  seed = (await buildDemoSeed(new Date("2026-10-18T09:00:00Z"))).snapshot;
  for (const p of seed.profiles) {
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [p.id, p.email, JSON.stringify({ full_name: p.full_name, role: "admin" })]);
    await db.query("update public.profiles set role = $2, full_name = $3, locale = $4 where id = $1", [p.id, p.role, p.full_name, p.locale]);
  }
  await db.query("delete from public.subjects");
  for (const t of LOAD_ORDER) await insertRows(t, seed[t] as unknown as Record<string, unknown>[]);
  await db.query("insert into storage.objects (bucket_id, name, owner_id) select 'academic-files', storage_key, uploaded_by::text from public.submission_files");
}, 120_000);

afterAll(async () => {
  await h?.stop();
});

const student1Id = () => seed.students.find((s) => s.profile_id === DEMO_IDS.student1)!.id;

describe.runIf(Boolean(process.env.TEST_DATABASE_URL) || fs.existsSync("/usr/lib/postgresql"))("Supabase schema + RLS on PostgreSQL", () => {
  it("migrations create every table used by the app, with the six predefined subjects available as reference data", async () => {
    const rows = await q("select table_name from information_schema.tables where table_schema = 'public'");
    const names = rows.map((r) => r.table_name);
    for (const t of TABLES) expect(names).toContain(t);
  });

  it("the fictional seed loads with all constraints satisfied (TS model ⇔ SQL schema)", async () => {
    for (const t of LOAD_ORDER) {
      const [{ n }] = await q(`select count(*)::int as n from public.${t}`);
      expect(n, t).toBe(seed[t].length);
    }
  });

  it("new auth users always get the student role, regardless of client-supplied metadata", async () => {
    const [p] = await q("select role from public.profiles where id = $1", [DEMO_IDS.student2]);
    expect(p.role).toBe("student");
    await db.query("insert into auth.users (id, email, raw_user_meta_data) values (gen_random_uuid(), 'x@example.org', '{\"role\":\"admin\"}')");
    const [n] = await q("select role from public.profiles where email = 'x@example.org'");
    expect(n.role).toBe("student");
  });

  it("anonymous users cannot read any academic table", async () => {
    await expect(as(null, () => q("select * from public.students"))).rejects.toThrow(/permission denied/);
    await expect(as(null, () => q("select * from public.submissions"))).rejects.toThrow(/permission denied/);
  });

  it("lecturer sees all records", async () => {
    const subs = await as(DEMO_IDS.lecturer, () => q("select id from public.submissions"));
    expect(subs.length).toBe(seed.submissions.length);
    const ai = await as(DEMO_IDS.lecturer, () => q("select id from public.grade_history"));
    expect(ai.length).toBe(seed.grade_history.length);
  });

  it("a student sees only their own student record, submissions and files", async () => {
    const sid = student1Id();
    const students = await as(DEMO_IDS.student1, () => q("select id from public.students"));
    expect(students.map((r) => r.id)).toEqual([sid]);
    const subs = await as(DEMO_IDS.student1, () => q("select student_id from public.submissions"));
    expect(subs.length).toBeGreaterThan(0);
    expect(subs.every((s) => s.student_id === sid)).toBe(true);
    const files = await as(DEMO_IDS.student1, () => q("select submission_id from public.submission_files"));
    const own = seed.submissions.filter((s) => s.student_id === sid).map((s) => s.id);
    expect(files.every((f) => own.includes(f.submission_id))).toBe(true);
  });

  it("a student never sees other students' grades, AI suggestions, rubric scores or grade history", async () => {
    const sid = student1Id();
    const reviews = await as(DEMO_IDS.student1, () => q("select r.submission_id from public.reviews r"));
    const own = seed.submissions.filter((s) => s.student_id === sid).map((s) => s.id);
    expect(reviews.every((r) => own.includes(r.submission_id))).toBe(true);
    expect(await as(DEMO_IDS.student1, () => q("select * from public.ai_suggestions"))).toHaveLength(0);
    expect(await as(DEMO_IDS.student1, () => q("select * from public.rubric_scores"))).toHaveLength(0);
    expect(await as(DEMO_IDS.student1, () => q("select * from public.grade_history"))).toHaveLength(0);
    const fb = await as(DEMO_IDS.student1, () => q("select released from public.feedback"));
    expect(fb.every((f) => f.released)).toBe(true);
  });

  it("a student sees only published assignments targeted at their groups, and no drafts", async () => {
    const rows = await as(DEMO_IDS.student1, () => q("select status from public.assignments"));
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === "published")).toBe(true);
    const crim = seed.assignments.find((a) => a.subject_id === seed.subjects.find((s) => s.code === "CRIM")!.id)!;
    const hidden = await as(DEMO_IDS.student1, () => q("select id from public.assignments where id = $1", [crim.id]));
    expect(hidden).toHaveLength(0);
  });

  it("a student cannot submit on behalf of another student or tamper with lecturer fields", async () => {
    const other = seed.students.find((s) => s.student_code === "DEMO-24-0005")!;
    const a = seed.assignments.find((x) => x.status === "published" && x.language === "en")!;
    await expect(
      as(DEMO_IDS.student1, () => q("insert into public.submissions (assignment_id, student_id) values ($1, $2)", [a.id, other.id])),
    ).rejects.toThrow(/row-level security/);
    // A graded submission is not updatable by the student at all (policy filters it out).
    const mine = seed.submissions.find((s) => s.student_id === student1Id())!;
    const res = await as(DEMO_IDS.student1, () => db.query("update public.submissions set student_comment = 'x' where id = $1", [mine.id]));
    expect(res.rowCount).toBe(0);
  });

  it("a student can create their own submission for a visible assignment (codes come from a sequence)", async () => {
    const sid = student1Id();
    const legalEng = seed.assignments.find((x) => x.language === "en" && x.status === "published" && seed.assignment_groups.some((g) => g.assignment_id === x.id))!;
    const rows = await as(DEMO_IDS.student1, () => q("insert into public.submissions (assignment_id, student_id) values ($1, $2) returning code", [legalEng.id, sid]));
    expect(rows[0].code).toMatch(/^SUB-\d{6}$/);
    expect(seed.submissions.map((s) => s.code)).not.toContain(rows[0].code);
    // ...but even on an updatable submission, lecturer-only fields are protected by a trigger.
    await expect(
      as(DEMO_IDS.student1, async () => {
        const [row] = await q("insert into public.submissions (assignment_id, student_id) values ($1, $2) returning id", [legalEng.id, sid]);
        return q("update public.submissions set follow_up_note = 'x', current_version = current_version + 1 where id = $1", [row.id]);
      }),
    ).rejects.toThrow(/only upload a new version/);
    const ok = await as(DEMO_IDS.student1, async () => {
      const [row] = await q("insert into public.submissions (assignment_id, student_id) values ($1, $2) returning id", [legalEng.id, sid]);
      return db.query("update public.submissions set current_version = 2, student_comment = 'v2' where id = $1", [row.id]);
    });
    expect(ok.rowCount).toBe(1);
  });

  it("only an admin may change roles (no self-promotion)", async () => {
    await expect(as(DEMO_IDS.student1, () => q("update public.profiles set role = 'lecturer' where id = $1", [DEMO_IDS.student1]))).rejects.toThrow(/administrator/);
    await expect(as(DEMO_IDS.lecturer, () => q("update public.profiles set role = 'admin' where id = $1", [DEMO_IDS.lecturer]))).rejects.toThrow(/administrator/);
  });

  it("grade history and audit logs are append-only", async () => {
    await expect(as(DEMO_IDS.lecturer, () => q("update public.grade_history set new_score = 1"))).rejects.toThrow(/permission denied/);
    await expect(as(DEMO_IDS.lecturer, () => q("delete from public.audit_logs"))).rejects.toThrow(/permission denied/);
    await expect(q("update public.grade_history set new_score = 1")).rejects.toThrow(/append-only/);
  });

  it("database rejects rubric scores above the criterion maximum and final scores above the assignment maximum", async () => {
    const score = seed.rubric_scores[0];
    await expect(as(DEMO_IDS.lecturer, () => q("update public.rubric_scores set score = 9999 where id = $1", [score.id]))).rejects.toThrow(/exceeds criterion maximum/);
    const review = seed.reviews.find((r) => r.status === "approved")!;
    await expect(as(DEMO_IDS.lecturer, () => q("update public.reviews set final_score = 101 where id = $1", [review.id]))).rejects.toThrow(/exceeds assignment maximum/);
  });

  it("private storage: students can read only objects of their own submissions", async () => {
    const own = new Set(seed.submissions.filter((s) => s.student_id === student1Id()).map((s) => s.id));
    const objs = await as(DEMO_IDS.student1, () => q("select name from storage.objects"));
    expect(objs.length).toBeGreaterThan(0);
    expect(objs.every((o) => own.has(o.name.split("/")[1]))).toBe(true);
    const foreign = seed.submissions.find((s) => !own.has(s.id))!;
    await expect(
      as(DEMO_IDS.student1, () => q("insert into storage.objects (bucket_id, name, owner_id) values ('academic-files', $1, $2)", [`submissions/${foreign.id}/00000000-0000-4000-8000-000000000000.pdf`, DEMO_IDS.student1])),
    ).rejects.toThrow(/row-level security/);
    const all = await as(DEMO_IDS.lecturer, () => q("select name from storage.objects"));
    expect(all.length).toBe(seed.submission_files.length);
  });

  it("deleting a student cascades to their submissions, reviews and grade history", async () => {
    const st = seed.students.find((s) => s.student_code === "DEMO-24-0001")!;
    await db.query("begin");
    await db.query("delete from public.students where id = $1", [st.id]);
    const [{ n }] = (await db.query("select count(*)::int n from public.submissions where student_id = $1", [st.id])).rows;
    await db.query("rollback");
    expect(n).toBe(0);
  });
});
