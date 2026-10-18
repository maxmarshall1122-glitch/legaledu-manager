import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import { computeTotal, validateFinalScore } from "@/lib/rubric";
import { getAssignmentForStudent } from "@/lib/services/assignments";
import { approveGrade, changeFinalGrade, markCompleted, requestRevision, saveReviewDraft } from "@/lib/services/grading";
import { getSubmissionDetail } from "@/lib/services/submissions";
import { world } from "./helpers";

const C = (id: string, max: number, weight = max) => ({ id, title: id, max_points: max, weight });

describe("rubric totals", () => {
  const rubric = [C("a", 25), C("b", 20), C("c", 20), C("d", 15), C("e", 10), C("f", 10)];
  it("default rubric: total is the plain sum", () => {
    expect(computeTotal(rubric, { a: 22, b: 17, c: 16, d: 12, e: 9, f: 9 }, 100)).toEqual({ total: 85, issues: [] });
    expect(computeTotal(rubric, { a: 25, b: 20, c: 20, d: 15, e: 10, f: 10 }, 100).total).toBe(100);
    expect(computeTotal(rubric, { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 }, 100).total).toBe(0);
  });
  it("custom weights and maximums scale to the assignment maximum", () => {
    // two criteria out of 10 each, weights 3:1, max score 20
    expect(computeTotal([C("x", 10, 3), C("y", 10, 1)], { x: 10, y: 0 }, 20).total).toBe(15);
    expect(computeTotal([C("x", 5), C("y", 5)], { x: 2.5, y: 5 }, 50).total).toBe(37.5);
  });
  it("rejects out-of-range, negative, missing and non-numeric scores", () => {
    expect(computeTotal(rubric, { a: 26, b: 0, c: 0, d: 0, e: 0, f: 0 }, 100).issues[0].message).toContain("validation.scoreRange");
    expect(computeTotal(rubric, { a: -1, b: 0, c: 0, d: 0, e: 0, f: 0 }, 100).total).toBeNull();
    expect(computeTotal(rubric, { a: NaN, b: 0, c: 0, d: 0, e: 0, f: 0 }, 100).total).toBeNull();
    expect(computeTotal(rubric, { a: 1 }, 100).issues.some((i) => i.message === "validation.required")).toBe(true);
    expect(computeTotal([], {}, 100).total).toBeNull();
  });
  it("final score may not exceed the maximum", () => {
    expect(validateFinalScore(101, 100)?.message).toContain("validation.totalExceedsMax");
    expect(validateFinalScore(-1, 100)).not.toBeNull();
    expect(validateFinalScore(100, 100)).toBeNull();
  });
});

async function pending(w: Awaited<ReturnType<typeof world>>) {
  const sub = (await w.repo.list("submissions")).find((s) => s.status === "submitted" && s.student_id === w.byCode("DEMO-24-0004").id)!;
  const criteria = await w.repo.list("rubric_criteria", { eq: { assignment_id: sub.assignment_id }, order: { column: "position" } });
  const scores = (vals: (number | null)[]) => criteria.map((c, i) => ({ criterion_id: c.id, score: vals[i] ?? null, comment: null }));
  return { sub, criteria, scores };
}

describe("grading workflow", () => {
  it("saving a draft records the provisional score, moves to under review and keeps feedback unreleased", async () => {
    const w = await world();
    const { sub, scores } = await pending(w);
    const r = await saveReviewDraft(w.lecturer, { submission_id: sub.id, scores: scores([20, 15]), student_feedback: "draft text" });
    expect(r.status).toBe("draft");
    expect(r.provisional_score).toBeNull(); // incomplete → no total yet
    expect((await w.repo.get("submissions", sub.id))!.status).toBe("under_review");
    const fb = await w.repo.list("feedback", { eq: { review_id: r.id } });
    expect(fb[0].released).toBe(false);
    // student cannot see the draft
    const view = await getAssignmentForStudent(w.ctx({ id: "s", role: "student", full_name: "", email: null, student_id: sub.student_id }), sub.assignment_id);
    expect(view.released).toHaveLength(0);
  });

  it("prevents invalid scores on the server", async () => {
    const w = await world();
    const { sub, scores } = await pending(w);
    await expect(saveReviewDraft(w.lecturer, { submission_id: sub.id, scores: scores([999]) })).rejects.toSatisfy(
      (e: unknown) => e instanceof AppError && Object.keys(e.fieldErrors ?? {}).includes("scores.0.score"),
    );
    await expect(approveGrade(w.lecturer, { submission_id: sub.id, scores: scores([20, 15]) })).rejects.toBeInstanceOf(AppError); // incomplete
    await expect(
      approveGrade(w.lecturer, { submission_id: sub.id, scores: scores([20, 15, 15, 10, 8, 8]), final_override: 120, override_reason: "x" }),
    ).rejects.toSatisfy((e: unknown) => (e as AppError).messageKey.includes("totalExceedsMax"));
    await expect(approveGrade(w.lecturer, { submission_id: sub.id, scores: scores([20, 15, 15, 10, 8, 8]), final_override: 70 })).rejects.toSatisfy(
      (e: unknown) => (e as AppError).messageKey === "validation.reasonRequired",
    );
  });

  it("approving records final grade, history and audit; releases feedback; then requires a reason to change", async () => {
    const w = await world();
    const { sub, scores } = await pending(w);
    const r = await approveGrade(w.lecturer, { submission_id: sub.id, scores: scores([20, 15, 15, 10, 8, 8]), student_feedback: "Well done" });
    expect(r.status).toBe("approved");
    expect(r.final_score).toBe(76);
    expect(r.approved_by).toBe(w.lecturer.user.id);
    expect((await w.repo.get("submissions", sub.id))!.status).toBe("graded");
    await expect(saveReviewDraft(w.lecturer, { submission_id: sub.id, scores: scores([1, 1, 1, 1, 1, 1]) })).rejects.toSatisfy(
      (e: unknown) => (e as AppError).messageKey === "grading.alreadyApproved",
    );
    await expect(changeFinalGrade(w.lecturer, { submission_id: sub.id, new_score: 80, reason: "" })).rejects.toBeInstanceOf(AppError);
    await changeFinalGrade(w.lecturer, { submission_id: sub.id, new_score: 80, reason: "Recount of criterion 1" });
    const hist = (await w.repo.list("grade_history", { eq: { submission_id: sub.id, kind: "final" }, order: { column: "created_at" } }));
    expect(hist.map((h) => [h.old_score, h.new_score])).toEqual([[null, 76], [76, 80]]);
    expect(hist[1].reason).toBe("Recount of criterion 1");
    const audit = await w.repo.list("audit_logs", { eq: { action: "grade.change" } });
    expect(audit[0].details).toMatchObject({ old_score: 76, new_score: 80 });
    // student sees only the approved final score
    const sctx = w.ctx({ id: "s", role: "student", full_name: "", email: null, student_id: sub.student_id });
    const view = await getAssignmentForStudent(sctx, sub.assignment_id);
    expect(view.released[0]).toMatchObject({ final_score: 80, student_feedback: "Well done" });
    const detail = await getSubmissionDetail(sctx, sub.id);
    expect(detail.history).toEqual([]); // grade history is staff-only
    expect(detail.scores).toEqual([]);
    await markCompleted(w.lecturer, sub.id);
    expect((await w.repo.get("submissions", sub.id))!.status).toBe("completed");
  });

  it("manual final override with a reason is kept separate from the calculated total", async () => {
    const w = await world();
    const { sub, scores } = await pending(w);
    const r = await approveGrade(w.lecturer, { submission_id: sub.id, scores: scores([20, 15, 15, 10, 8, 8]), final_override: 70, override_reason: "Late penalty" });
    expect(r.provisional_score).toBe(76);
    expect(r.final_score).toBe(70);
  });

  it("revision requests release feedback to the student and set a future deadline", async () => {
    const w = await world();
    const { sub, scores } = await pending(w);
    await expect(requestRevision(w.lecturer, { submission_id: sub.id, scores: scores([]), revision_deadline: "2020-01-01T00:00:00Z" })).rejects.toBeInstanceOf(AppError);
    const future = new Date(Date.now() + 5 * 86400_000).toISOString();
    await requestRevision(w.lecturer, { submission_id: sub.id, scores: scores([10]), student_feedback: "Please revise", revision_deadline: future });
    const s = (await w.repo.get("submissions", sub.id))!;
    expect(s.status).toBe("revision_required");
    expect(s.revision_deadline).toBe(future);
    const view = await getAssignmentForStudent(w.ctx({ id: "s", role: "student", full_name: "", email: null, student_id: sub.student_id }), sub.assignment_id);
    expect(view.released[0]).toMatchObject({ revision_requested: true, final_score: null, student_feedback: "Please revise" });
  });
});
