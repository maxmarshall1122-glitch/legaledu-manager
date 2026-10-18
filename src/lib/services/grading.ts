import { invalid } from "@/lib/errors";
import { computeTotal, validateFinalScore } from "@/lib/rubric";
import type { Review, Submission } from "@/lib/types";
import { changeFinalSchema, fieldErrors, reviewSchema, type ReviewData, type ReviewInput } from "@/lib/validation";
import { audit, byId, mustGet, requireGrader, requireStaff, type Ctx } from "./core";

export async function getGradingQueue(ctx: Ctx, filter: "awaiting" | "revision" | "graded" | "all" = "awaiting") {
  requireStaff(ctx);
  const [subs, assignments, students, subjects] = await Promise.all([
    ctx.repo.list("submissions", { order: { column: "submitted_at" } }),
    ctx.repo.list("assignments"),
    ctx.repo.list("students"),
    ctx.repo.list("subjects"),
  ]);
  const want: Record<typeof filter, Submission["status"][]> = {
    awaiting: ["submitted", "resubmitted", "under_review"],
    revision: ["revision_required"],
    graded: ["graded", "completed"],
    all: ["submitted", "resubmitted", "under_review", "revision_required", "graded", "completed"],
  };
  const aMap = byId(assignments);
  const sMap = byId(students);
  const subjMap = byId(subjects);
  return subs
    .filter((s) => want[filter].includes(s.status))
    .map((s) => {
      const a = aMap.get(s.assignment_id)!;
      return { submission: s, assignment: a, student: sMap.get(s.student_id) ?? null, subject: subjMap.get(a.subject_id) ?? null };
    });
}

async function currentReview(ctx: Ctx, submission: Submission): Promise<Review | null> {
  const rows = await ctx.repo.list("reviews", { eq: { submission_id: submission.id, version: submission.current_version } });
  return rows[0] ?? null;
}

export async function getGradingData(ctx: Ctx, submissionId: string) {
  requireStaff(ctx);
  const submission = await mustGet(ctx, "submissions", submissionId);
  const assignment = await mustGet(ctx, "assignments", submission.assignment_id);
  const [criteria, review, files, suggestions, student, subject] = await Promise.all([
    ctx.repo.list("rubric_criteria", { eq: { assignment_id: assignment.id }, order: { column: "position" } }),
    currentReview(ctx, submission),
    ctx.repo.list("submission_files", { eq: { submission_id: submission.id, version: submission.current_version } }),
    ctx.repo.list("ai_suggestions", { eq: { submission_id: submission.id }, order: { column: "created_at", ascending: false } }),
    ctx.repo.get("students", submission.student_id),
    ctx.repo.get("subjects", assignment.subject_id),
  ]);
  const scores = review ? await ctx.repo.list("rubric_scores", { eq: { review_id: review.id } }) : [];
  const feedback = review ? (await ctx.repo.list("feedback", { eq: { review_id: review.id } }))[0] ?? null : null;
  return { submission, assignment, criteria, review, scores, feedback, files, suggestions, student, subject };
}

function parseReview(input: ReviewInput): ReviewData {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  return parsed.data;
}

/**
 * Validates the scores against the assignment rubric. `requireAll` is used
 * for approval; drafts may be partially filled but every entered score must
 * still be within its criterion's range.
 */
async function evaluate(ctx: Ctx, submission: Submission, data: ReviewData, requireAll: boolean) {
  const assignment = await mustGet(ctx, "assignments", submission.assignment_id);
  const criteria = await ctx.repo.list("rubric_criteria", { eq: { assignment_id: assignment.id }, order: { column: "position" } });
  if (criteria.length === 0) throw invalid("grading.noRubric");
  const scoreMap: Record<string, number | null> = {};
  for (const s of data.scores) {
    if (!criteria.some((c) => c.id === s.criterion_id)) throw invalid("validation.invalidSelection");
    scoreMap[s.criterion_id] = s.score;
  }
  const { total, issues } = computeTotal(criteria, scoreMap, assignment.max_score);
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    if (!requireAll && issue.message === "validation.required") continue;
    const idx = criteria.findIndex((c) => c.id === issue.criterion_id);
    errors[idx >= 0 ? `scores.${idx}.score` : "_form"] = issue.message;
  }
  if (Object.keys(errors).length > 0) throw invalid(Object.values(errors)[0], errors);
  return { assignment, criteria, total };
}

async function upsertReview(
  ctx: Ctx,
  submission: Submission,
  data: ReviewData,
  provisional: number | null,
  extra: Partial<Review>,
  released: boolean,
): Promise<Review> {
  let review = await currentReview(ctx, submission);
  const now = new Date().toISOString();
  const patch: Partial<Review> = {
    reviewer_id: ctx.user.id,
    provisional_score: provisional,
    reviewed_at: now,
    ai_suggestion_id: data.ai_suggestion_id ?? review?.ai_suggestion_id ?? null,
    ...extra,
  };
  const before = review?.provisional_score ?? null;
  if (review) {
    review = await ctx.repo.update("reviews", review.id, patch);
  } else {
    review = await ctx.repo.insert("reviews", {
      submission_id: submission.id,
      version: submission.current_version,
      status: "draft",
      final_score: null,
      revision_requested: false,
      revision_deadline: null,
      approved_at: null,
      approved_by: null,
      reviewer_id: ctx.user.id,
      provisional_score: provisional,
      reviewed_at: now,
      ai_suggestion_id: data.ai_suggestion_id ?? null,
      ...extra,
    });
  }
  // Replace rubric scores.
  const old = await ctx.repo.list("rubric_scores", { eq: { review_id: review.id } });
  for (const s of old) await ctx.repo.remove("rubric_scores", s.id);
  for (const s of data.scores) {
    if (s.score === null) continue;
    await ctx.repo.insert("rubric_scores", { review_id: review.id, criterion_id: s.criterion_id, score: s.score, comment: s.comment });
  }
  const fb = (await ctx.repo.list("feedback", { eq: { review_id: review.id } }))[0];
  const fbData = {
    strengths: data.strengths,
    improvements: data.improvements,
    student_feedback: data.student_feedback,
    released: released || Boolean(fb?.released),
  };
  if (fb) await ctx.repo.update("feedback", fb.id, fbData);
  else await ctx.repo.insert("feedback", { review_id: review.id, submission_id: submission.id, ...fbData });

  if (before !== provisional) {
    await ctx.repo.insert("grade_history", {
      submission_id: submission.id,
      review_id: review.id,
      kind: "provisional",
      old_score: before,
      new_score: provisional,
      reason: null,
      changed_by: ctx.user.id,
    });
  }
  if (data.ai_suggestion_id) await settleSuggestion(ctx, data);
  return review;
}

/** Marks the AI suggestion the lecturer worked from as approved (unchanged) or edited. */
async function settleSuggestion(ctx: Ctx, data: ReviewData) {
  const s = await ctx.repo.get("ai_suggestions", data.ai_suggestion_id!);
  if (!s || s.submission_id !== data.submission_id || !s.parsed || s.status === "rejected") return;
  const unchanged = s.parsed.criteria.every((c) => data.scores.find((x) => x.criterion_id === c.criterion_id)?.score === c.suggested_score);
  await ctx.repo.update("ai_suggestions", s.id, {
    status: unchanged ? "approved" : "edited",
    decided_by: ctx.user.id,
    decided_at: new Date().toISOString(),
  });
}

export async function saveReviewDraft(ctx: Ctx, input: ReviewInput): Promise<Review> {
  requireStaff(ctx);
  const data = parseReview(input);
  const submission = await mustGet(ctx, "submissions", data.submission_id);
  const existing = await currentReview(ctx, submission);
  if (existing?.status === "approved") throw invalid("grading.alreadyApproved");
  const { total } = await evaluate(ctx, submission, data, false);
  const review = await upsertReview(ctx, submission, data, total, {}, false);
  if (["submitted", "resubmitted"].includes(submission.status)) {
    await ctx.repo.update("submissions", submission.id, { status: "under_review" });
  }
  await audit(ctx, "review.save_draft", "reviews", review.id, { submission_id: submission.id, provisional: total });
  return review;
}

export async function approveGrade(ctx: Ctx, input: ReviewInput): Promise<Review> {
  requireGrader(ctx);
  const data = parseReview(input);
  const submission = await mustGet(ctx, "submissions", data.submission_id);
  const existing = await currentReview(ctx, submission);
  if (existing?.status === "approved") throw invalid("grading.alreadyApproved");
  const { assignment, total } = await evaluate(ctx, submission, data, true);
  let finalScore = total!;
  if (data.final_override !== null && data.final_override !== total) {
    const issue = validateFinalScore(data.final_override, assignment.max_score);
    if (issue) throw invalid(issue.message, { final_override: issue.message });
    if (!data.override_reason) throw invalid("validation.reasonRequired", { override_reason: "validation.reasonRequired" });
    finalScore = data.final_override;
  }
  const now = new Date().toISOString();
  const review = await upsertReview(
    ctx,
    submission,
    data,
    total,
    { status: "approved", final_score: finalScore, approved_at: now, approved_by: ctx.user.id, revision_requested: false, revision_deadline: null },
    true,
  );
  await ctx.repo.insert("grade_history", {
    submission_id: submission.id,
    review_id: review.id,
    kind: "final",
    old_score: null,
    new_score: finalScore,
    reason: finalScore !== total ? data.override_reason : null,
    changed_by: ctx.user.id,
  });
  await ctx.repo.update("submissions", submission.id, { status: "graded", revision_deadline: null });
  await audit(ctx, "grade.approve", "reviews", review.id, {
    submission_id: submission.id,
    final_score: finalScore,
    calculated: total,
    ai_assisted: Boolean(review.ai_suggestion_id),
  });
  return review;
}

export async function requestRevision(ctx: Ctx, input: ReviewInput): Promise<Review> {
  requireGrader(ctx);
  const data = parseReview(input);
  if (!data.revision_deadline) throw invalid("validation.required", { revision_deadline: "validation.required" });
  if (data.revision_deadline <= new Date().toISOString()) {
    throw invalid("validation.invalidDate", { revision_deadline: "validation.invalidDate" });
  }
  const submission = await mustGet(ctx, "submissions", data.submission_id);
  const existing = await currentReview(ctx, submission);
  if (existing?.status === "approved") throw invalid("grading.alreadyApproved");
  const { total } = await evaluate(ctx, submission, data, false);
  const review = await upsertReview(ctx, submission, data, total, { revision_requested: true, revision_deadline: data.revision_deadline }, true);
  await ctx.repo.update("submissions", submission.id, { status: "revision_required", revision_deadline: data.revision_deadline });
  await audit(ctx, "review.request_revision", "reviews", review.id, { submission_id: submission.id, deadline: data.revision_deadline });
  return review;
}

/** Changing an approved final grade always requires a reason and is recorded in grade_history and audit_logs. */
export async function changeFinalGrade(ctx: Ctx, input: unknown): Promise<Review> {
  requireGrader(ctx);
  const parsed = changeFinalSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  const { submission_id, new_score, reason } = parsed.data;
  const submission = await mustGet(ctx, "submissions", submission_id);
  const assignment = await mustGet(ctx, "assignments", submission.assignment_id);
  const approved = (await ctx.repo.list("reviews", { eq: { submission_id, status: "approved" } })).sort((a, b) => b.version - a.version)[0];
  if (!approved) throw invalid("errors.notFound");
  const issue = validateFinalScore(new_score, assignment.max_score);
  if (issue) throw invalid(issue.message, { new_score: issue.message });
  const old = approved.final_score;
  const review = await ctx.repo.update("reviews", approved.id, { final_score: new_score, approved_by: ctx.user.id, approved_at: new Date().toISOString() });
  await ctx.repo.insert("grade_history", {
    submission_id,
    review_id: approved.id,
    kind: "final",
    old_score: old,
    new_score,
    reason,
    changed_by: ctx.user.id,
  });
  await audit(ctx, "grade.change", "reviews", approved.id, { submission_id, old_score: old, new_score, reason });
  return review;
}

export async function markCompleted(ctx: Ctx, submissionId: string) {
  requireGrader(ctx);
  const s = await mustGet(ctx, "submissions", submissionId);
  if (s.status !== "graded") throw invalid("errors.conflict");
  await ctx.repo.update("submissions", submissionId, { status: "completed" });
  await audit(ctx, "submission.complete", "submissions", submissionId, null);
}
