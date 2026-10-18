import { MemoryRepo } from "@/lib/db/memory-repo";
import { buildDemoSeed, DEMO_IDS } from "@/lib/demo/seed";
import { resetRateLimits } from "@/lib/rate-limit";
import type { Ctx } from "@/lib/services/core";
import { MemoryFileStorage } from "@/lib/storage/storage";
import type { SessionUser } from "@/lib/types";

export const LIMITS = { maxFileBytes: 2 * 1024 * 1024, maxFilesPerSubmission: 3 };

let cached: Awaited<ReturnType<typeof buildDemoSeed>> | null = null;

/** Fresh, isolated world (repo + storage) built from the fictional seed. */
export async function world() {
  cached ??= await buildDemoSeed(new Date("2026-10-18T09:00:00Z"));
  resetRateLimits();
  const repo = new MemoryRepo(cached.snapshot);
  const storage = new MemoryFileStorage();
  for (const [k, v] of cached.files) storage.files.set(k, v);
  const students = await repo.list("students");
  const byCode = (code: string) => students.find((s) => s.student_code === code)!;

  const lecturer: SessionUser = { id: DEMO_IDS.lecturer, role: "lecturer", full_name: "Lecturer", email: null, student_id: null };
  const admin: SessionUser = { id: DEMO_IDS.admin, role: "admin", full_name: "Admin", email: null, student_id: null };
  const student1: SessionUser = { id: DEMO_IDS.student1, role: "student", full_name: "S1", email: null, student_id: byCode("DEMO-24-0001").id };
  const student2: SessionUser = { id: DEMO_IDS.student2, role: "student", full_name: "S2", email: null, student_id: byCode("DEMO-24-0006").id };
  const ctx = (user: SessionUser): Ctx => ({ repo, storage, user, locale: "en" });
  return { repo, storage, byCode, lecturer: ctx(lecturer), admin: ctx(admin), student1: ctx(student1), student2: ctx(student2), ctx };
}

export const txtFile = (name: string, body = "Fictional test content.") => ({ name, type: "text/plain", bytes: new TextEncoder().encode(body) });
