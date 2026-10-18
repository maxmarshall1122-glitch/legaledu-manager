import { SUBMISSION_STATUSES } from "@/lib/types";
import { avg, byId, pct, requireStaff, type Ctx } from "./core";

/** All figures are computed from stored records at request time. */
export async function getDashboard(ctx: Ctx, now = new Date()) {
  requireStaff(ctx);
  const [students, groups, assignments, submissions, reviews, subjects] = await Promise.all([
    ctx.repo.list("students"),
    ctx.repo.list("groups"),
    ctx.repo.list("assignments"),
    ctx.repo.list("submissions"),
    ctx.repo.list("reviews", { eq: { status: "approved" } }),
    ctx.repo.list("subjects", { order: { column: "code" } }),
  ]);
  const aMap = byId(assignments);
  const count = (st: string[]) => submissions.filter((s) => st.includes(s.status)).length;

  const latestApproved = new Map<string, (typeof reviews)[number]>();
  for (const r of reviews) {
    const prev = latestApproved.get(r.submission_id);
    if (!prev || r.version > prev.version) latestApproved.set(r.submission_id, r);
  }
  const percents = [...latestApproved.values()].map((r) => {
    const sub = submissions.find((s) => s.id === r.submission_id);
    const a = sub ? aMap.get(sub.assignment_id) : undefined;
    return a ? pct(r.final_score, a.max_score) : null;
  });

  const in14 = new Date(now.getTime() + 14 * 86400_000).toISOString();
  const nowIso = now.toISOString();
  const upcoming = assignments
    .filter((a) => a.status === "published" && a.deadline && a.deadline >= nowIso && a.deadline <= in14)
    .sort((a, b) => a.deadline!.localeCompare(b.deadline!))
    .map((a) => ({ assignment: a, subject: subjects.find((s) => s.id === a.subject_id) ?? null }));
  const revisionDeadlines = submissions
    .filter((s) => s.status === "revision_required" && s.revision_deadline && s.revision_deadline >= nowIso && s.revision_deadline <= in14)
    .map((s) => ({ submission: s, assignment: aMap.get(s.assignment_id) ?? null }));

  const followUps = submissions
    .filter((s) => s.follow_up_note)
    .sort((a, b) => String(a.follow_up_due ?? "9999").localeCompare(String(b.follow_up_due ?? "9999")))
    .slice(0, 8)
    .map((s) => ({ submission: s, assignment: aMap.get(s.assignment_id) ?? null, student: students.find((x) => x.id === s.student_id) ?? null }));

  const graded = count(["graded", "completed"]);
  return {
    totals: {
      students: students.length,
      groups: groups.length,
      activeAssignments: assignments.filter((a) => a.status === "published").length,
      submitted: submissions.length,
      awaitingReview: count(["submitted", "resubmitted", "under_review"]),
      revision: count(["revision_required"]),
      completedGrading: graded,
      averagePercent: avg(percents),
      gradedCount: percents.filter((p) => p !== null).length,
    },
    statusChart: SUBMISSION_STATUSES.map((s) => ({ status: s, count: submissions.filter((x) => x.status === s).length })),
    workload: subjects.map((s) => {
      const ids = new Set(assignments.filter((a) => a.subject_id === s.id).map((a) => a.id));
      return {
        subject: s,
        assignments: ids.size,
        submissions: submissions.filter((x) => ids.has(x.assignment_id)).length,
      };
    }),
    grading: { graded, ungraded: submissions.length - graded },
    upcoming,
    revisionDeadlines,
    followUps,
  };
}
