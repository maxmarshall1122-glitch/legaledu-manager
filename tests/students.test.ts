import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { getStudentDetail, createStudent, deleteStudent, listStudents, updateStudent } from "@/lib/services/students";
import { addGroupMember, createGroup, deleteGroup, getGroupDetail, removeGroupMember } from "@/lib/services/groups";
import { world } from "./helpers";

const base = { full_name: "Fictional Person", academic_year: "2025-2026", enrollment_status: "active" as const };

describe("students", () => {
  it("creates a student with group membership and an audit entry", async () => {
    const w = await world();
    const group = (await w.repo.list("groups"))[0];
    const s = await createStudent(w.lecturer, { ...base, student_code: "law-25-0100", email: "Person@Uni.example", group_ids: [group.id] });
    expect(s.student_code).toBe("LAW-25-0100");
    expect(s.email).toBe("person@uni.example");
    const m = await w.repo.list("group_memberships", { eq: { student_id: s.id } });
    expect(m.map((x) => x.group_id)).toEqual([group.id]);
    const audit = await w.repo.list("audit_logs", { eq: { entity_id: s.id } });
    expect(audit[0].action).toBe("student.create");
  });

  it("prevents duplicate student IDs (case-insensitive) on create and edit", async () => {
    const w = await world();
    const dup = createStudent(w.lecturer, { ...base, student_code: "demo-24-0001" });
    await expect(dup).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.fieldErrors?.student_code === "students.duplicateCode");
    const other = w.byCode("DEMO-24-0002");
    await expect(updateStudent(w.lecturer, other.id, { ...base, student_code: "DEMO-24-0001" })).rejects.toBeInstanceOf(AppError);
  });

  it("validates input on the server", async () => {
    const w = await world();
    const bad = createStudent(w.lecturer, { student_code: "x", full_name: "", academic_year: "2025-2027", enrollment_status: "active", email: "nope" });
    await expect(bad).rejects.toSatisfy((e: unknown) => {
      const fe = (e as AppError).fieldErrors!;
      return fe.student_code === "validation.invalidCode" && fe.full_name === "validation.required" && fe.academic_year === "validation.invalidYear" && fe.email === "validation.invalidEmail";
    });
  });

  it("edits a student and replaces group memberships", async () => {
    const w = await world();
    const s = w.byCode("DEMO-24-0002");
    const groups = await w.repo.list("groups");
    const target = groups.find((g) => g.name === "LAW-102")!;
    const updated = await updateStudent(w.lecturer, s.id, { ...base, student_code: s.student_code, full_name: "Renamed Fictional", enrollment_status: "on_leave", group_ids: [target.id] });
    expect(updated.full_name).toBe("Renamed Fictional");
    expect(updated.enrollment_status).toBe("on_leave");
    const m = await w.repo.list("group_memberships", { eq: { student_id: s.id } });
    expect(m.map((x) => x.group_id)).toEqual([target.id]);
  });

  it("deleting a student removes their submissions, grades and stored files", async () => {
    const w = await world();
    const s = w.byCode("DEMO-24-0001");
    const subs = await w.repo.list("submissions", { eq: { student_id: s.id } });
    const files = await w.repo.list("submission_files", { in: { column: "submission_id", values: subs.map((x) => x.id) } });
    expect(files.length).toBeGreaterThan(0);
    await deleteStudent(w.lecturer, s.id);
    expect(await w.repo.get("students", s.id)).toBeNull();
    expect(await w.repo.list("submissions", { eq: { student_id: s.id } })).toHaveLength(0);
    for (const sub of subs) expect(await w.repo.list("reviews", { eq: { submission_id: sub.id } })).toHaveLength(0);
    for (const f of files) expect(w.storage.files.has(f.storage_key)).toBe(false);
    // grade history goes with the deleted record; the deletion itself is audited
    expect((await w.repo.list("audit_logs", { eq: { action: "student.delete" } })).length).toBe(1);
  });

  it("student profile lists progress across assignments", async () => {
    const w = await world();
    const d = await getStudentDetail(w.lecturer, w.byCode("DEMO-24-0001").id);
    expect(d.progress.some((p) => p.status === "graded" && p.finalScore === 85)).toBe(true);
    expect(d.progress.some((p) => p.status === "assigned")).toBe(true);
  });
});

describe("search, filtering, sorting and pagination", () => {
  it("filters by text, group, status and year", async () => {
    const w = await world();
    const groups = await w.repo.list("groups");
    const law102 = groups.find((g) => g.name === "LAW-102")!;
    expect((await listStudents(w.lecturer, { q: "kamola" })).rows.map((r) => r.student_code)).toEqual(["DEMO-24-0006"]);
    expect((await listStudents(w.lecturer, { group: law102.id })).total).toBe(4);
    expect((await listStudents(w.lecturer, { status: "on_leave" })).rows.map((r) => r.student_code)).toEqual(["DEMO-24-0009"]);
    expect((await listStudents(w.lecturer, { year: "2024-2025" })).total).toBe(3);
  });

  it("sorts and paginates", async () => {
    const w = await world();
    const desc = await listStudents(w.lecturer, { sort: "student_code", dir: "desc", pageSize: 5, page: 1 });
    expect(desc.rows[0].student_code).toBe("DEMO-24-0009");
    expect(desc.pages).toBe(3);
    const p3 = await listStudents(w.lecturer, { sort: "student_code", dir: "asc", pageSize: 5, page: 3 });
    expect(p3.rows).toHaveLength(2);
    const clamped = await listStudents(w.lecturer, { pageSize: 5, page: 99 });
    expect(clamped.page).toBe(3);
  });
});

describe("groups", () => {
  it("manages members and rejects duplicate names", async () => {
    const w = await world();
    const g = await createGroup(w.lecturer, { name: "LAW-301", academic_year: "2025-2026", description: "Fictional" });
    await expect(createGroup(w.lecturer, { name: "law-301", academic_year: "2025-2026" })).rejects.toBeInstanceOf(AppError);
    const s = w.byCode("DEMO-24-0002");
    await addGroupMember(w.lecturer, g.id, s.id);
    await addGroupMember(w.lecturer, g.id, s.id); // idempotent
    expect((await getGroupDetail(w.lecturer, g.id)).members.map((m) => m.id)).toEqual([s.id]);
    await removeGroupMember(w.lecturer, g.id, s.id);
    expect((await getGroupDetail(w.lecturer, g.id)).members).toHaveLength(0);
    await deleteGroup(w.lecturer, g.id);
    expect(await w.repo.get("groups", g.id)).toBeNull();
    expect(await w.repo.get("students", s.id)).not.toBeNull();
  });
});
