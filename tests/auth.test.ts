import { describe, expect, it } from "vitest";
import { signSession, verifySession } from "@/lib/auth/demo-session";
import { AppError } from "@/lib/errors";
import { listAssignments } from "@/lib/services/assignments";
import { getDashboard } from "@/lib/services/dashboard";
import { approveGrade, changeFinalGrade, getGradingQueue, saveReviewDraft } from "@/lib/services/grading";
import { createGroup } from "@/lib/services/groups";
import { buildReport } from "@/lib/services/reports";
import { listAuditLog } from "@/lib/services/search";
import { createStudent, deleteStudent, listStudents } from "@/lib/services/students";
import { listSubjectsWithStats } from "@/lib/services/subjects";
import { world } from "./helpers";

const SECRET = "x".repeat(64);

describe("demo session tokens", () => {
  it("round-trips a signed session", () => {
    expect(verifySession(signSession("user-1", SECRET), SECRET)).toBe("user-1");
  });
  it("rejects tampered payloads, wrong secrets, garbage and expired tokens", () => {
    const token = signSession("user-1", SECRET);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: 9999999999 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, SECRET)).toBeNull();
    expect(verifySession(token, "y".repeat(64))).toBeNull();
    expect(verifySession(`${payload}`, SECRET)).toBeNull();
    expect(verifySession("not.a-token", SECRET)).toBeNull();
    expect(verifySession(undefined, SECRET)).toBeNull();
    const old = signSession("user-1", SECRET, Date.now() - 9 * 3600_000);
    expect(verifySession(old, SECRET)).toBeNull();
  });
});

describe("server-side authorization", () => {
  const forbidden = (p: Promise<unknown>) => expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === "forbidden");

  it("students cannot call any staff service", async () => {
    const w = await world();
    const s = w.student1;
    await forbidden(listStudents(s));
    await forbidden(getDashboard(s));
    await forbidden(listAssignments(s));
    await forbidden(listSubjectsWithStats(s));
    await forbidden(getGradingQueue(s));
    await forbidden(buildReport(s, "grades", {}, "en"));
    await forbidden(createStudent(s, { student_code: "HACK-001", full_name: "x", academic_year: "2025-2026", enrollment_status: "active" }));
    await forbidden(createGroup(s, { name: "x", academic_year: "2025-2026" }));
    await forbidden(deleteStudent(s, w.byCode("DEMO-24-0002").id));
    const sub = (await w.repo.list("submissions"))[0];
    await forbidden(saveReviewDraft(s, { submission_id: sub.id, scores: [] }));
    await forbidden(approveGrade(s, { submission_id: sub.id, scores: [] }));
    await forbidden(changeFinalGrade(s, { submission_id: sub.id, new_score: 100, reason: "please" }));
    expect(await listAuditLog(s)).toEqual([]);
  });

  it("lecturers and admins can use staff services", async () => {
    const w = await world();
    expect((await listStudents(w.lecturer)).total).toBe(12);
    expect((await listStudents(w.admin)).total).toBe(12);
  });
});
