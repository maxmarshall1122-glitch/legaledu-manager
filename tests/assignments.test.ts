import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { defaultRubric } from "@/lib/rubric";
import {
  createAssignment,
  getAssignmentForStudent,
  listAssignmentsForStudent,
  setAssignmentStatus,
  updateAssignment,
} from "@/lib/services/assignments";
import { world } from "./helpers";

async function input(w: Awaited<ReturnType<typeof world>>, overrides: Record<string, unknown> = {}) {
  const subject = (await w.repo.list("subjects"))[0];
  const group = (await w.repo.list("groups")).find((g) => g.name === "LAW-101")!;
  return {
    title: "Fictional test assignment",
    subject_id: subject.id,
    group_ids: [group.id],
    description: "Desc",
    instructions: "Do it",
    language: "en" as const,
    assignment_type: "essay" as const,
    issue_date: "2026-10-01T09:00:00Z",
    deadline: "2026-11-01T18:00:00Z",
    max_score: 100,
    criteria: defaultRubric("en"),
    material_ids: [],
    ...overrides,
  };
}

describe("assignments", () => {
  it("creates a draft with default rubric (25/20/20/15/10/10) and a generated code", async () => {
    const w = await world();
    const a = await createAssignment(w.lecturer, await input(w), "draft");
    expect(a.code).toMatch(/^ASG-\d{4}$/);
    expect(a.status).toBe("draft");
    const crit = await w.repo.list("rubric_criteria", { eq: { assignment_id: a.id }, order: { column: "position" } });
    expect(crit.map((c) => c.max_points)).toEqual([25, 20, 20, 15, 10, 10]);
  });

  it("publishing requires target groups and a deadline", async () => {
    const w = await world();
    await expect(createAssignment(w.lecturer, await input(w, { group_ids: [] }), "published")).rejects.toSatisfy(
      (e: unknown) => (e as AppError).messageKey === "assignments.publishRequiresGroups",
    );
    await expect(createAssignment(w.lecturer, await input(w, { deadline: "" }), "published")).rejects.toSatisfy(
      (e: unknown) => (e as AppError).messageKey === "assignments.publishRequiresDeadline",
    );
  });

  it("rejects deadline before issue date and empty rubric", async () => {
    const w = await world();
    await expect(createAssignment(w.lecturer, await input(w, { deadline: "2026-09-01T00:00:00Z" }), "draft")).rejects.toSatisfy(
      (e: unknown) => (e as AppError).fieldErrors?.deadline === "validation.deadlineBeforeIssue",
    );
    await expect(createAssignment(w.lecturer, await input(w, { criteria: [] }), "draft")).rejects.toBeInstanceOf(AppError);
  });

  it("edits rubric criteria (add/update/remove) but refuses to remove scored criteria", async () => {
    const w = await world();
    const a = await createAssignment(w.lecturer, await input(w), "draft");
    const crit = await w.repo.list("rubric_criteria", { eq: { assignment_id: a.id }, order: { column: "position" } });
    const next = crit.slice(0, 2).map((c) => ({ id: c.id, title: `${c.title}!`, max_points: 50, weight: 50 }));
    await updateAssignment(w.lecturer, a.id, await input(w, { criteria: [...next, { title: "Custom", max_points: 10, weight: 5 }] }));
    const after = await w.repo.list("rubric_criteria", { eq: { assignment_id: a.id }, order: { column: "position" } });
    expect(after.map((c) => [c.title.endsWith("!") || c.title === "Custom", c.max_points])).toEqual([[true, 50], [true, 50], [true, 10]]);

    // A seeded graded assignment has scores on all criteria.
    const graded = (await w.repo.list("assignments")).find((x) => x.language === "uz" && x.status === "published")!;
    const gc = await w.repo.list("rubric_criteria", { eq: { assignment_id: graded.id }, order: { column: "position" } });
    const groups = (await w.repo.list("assignment_groups", { eq: { assignment_id: graded.id } })).map((g) => g.group_id);
    await expect(
      updateAssignment(w.lecturer, graded.id, {
        ...(await input(w)),
        subject_id: graded.subject_id,
        group_ids: groups,
        criteria: gc.slice(1).map((c) => ({ id: c.id, title: c.title, max_points: c.max_points, weight: c.weight })),
      }),
    ).rejects.toSatisfy((e: unknown) => (e as AppError).messageKey === "errors.conflict");
  });

  it("student view: only published assignments for the student's own groups", async () => {
    const w = await world();
    const draft = await createAssignment(w.lecturer, await input(w), "draft");
    let mine = await listAssignmentsForStudent(w.student1);
    expect(mine.some((m) => m.assignment.id === draft.id)).toBe(false);
    await setAssignmentStatus(w.lecturer, draft.id, "published");
    mine = await listAssignmentsForStudent(w.student1);
    expect(mine.find((m) => m.assignment.id === draft.id)?.status).toBe("assigned");
    // student2 is in LAW-102, not targeted
    await expect(getAssignmentForStudent(w.student2, draft.id)).rejects.toSatisfy((e: unknown) => (e as AppError).code === "not_found");
    await setAssignmentStatus(w.lecturer, draft.id, "archived");
    expect((await listAssignmentsForStudent(w.student1)).some((m) => m.assignment.id === draft.id)).toBe(false);
  });

  it("student view hides staff-only materials", async () => {
    const w = await world();
    const a1 = (await w.repo.list("assignments")).find((a) => a.title.startsWith("Shaxsga"))!;
    const d = await getAssignmentForStudent(w.student1, a1.id);
    expect(d.materials.length).toBeGreaterThan(0);
    expect(d.materials.every((m) => m.visible_to_students)).toBe(true);
  });
});
