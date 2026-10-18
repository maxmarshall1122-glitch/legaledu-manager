import type { Locale, WorkStatus } from "@/lib/types";
import { avg, byId, deriveWorkStatus, pct, requireStaff, subjectName, type Ctx } from "./core";

export const REPORT_TYPES = ["register", "status", "outstanding", "grades", "progress", "subjects"] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface ReportFilters {
  subject?: string;
  group?: string;
  assignment?: string;
  status?: string;
  from?: string;
  to?: string;
}

/** Column definition. `key` is a translation key under reports.columns. Values: null = missing data (never coerced to 0). */
export interface ReportColumn {
  key: string;
  kind: "text" | "number" | "date" | "status" | "bool";
}
export type ReportValue = string | number | boolean | null;
export interface Report {
  type: ReportType;
  columns: ReportColumn[];
  rows: ReportValue[][];
}

const C = (key: string, kind: ReportColumn["kind"] = "text"): ReportColumn => ({ key, kind });

/** Student × assignment work items for published/archived assignments the student is targeted by (or submitted to). */
async function workItems(ctx: Ctx, f: ReportFilters, locale: Locale) {
  const [students, groups, memberships, assignments, ag, submissions, reviews, subjects] = await Promise.all([
    ctx.repo.list("students", { order: { column: "student_code" } }),
    ctx.repo.list("groups"),
    ctx.repo.list("group_memberships"),
    ctx.repo.list("assignments"),
    ctx.repo.list("assignment_groups"),
    ctx.repo.list("submissions"),
    ctx.repo.list("reviews"),
    ctx.repo.list("subjects"),
  ]);
  const gMap = byId(groups);
  const sMap = byId(subjects);
  const items: {
    student: (typeof students)[number];
    groupNames: string;
    assignment: (typeof assignments)[number];
    subject: string;
    status: WorkStatus;
    submission: (typeof submissions)[number] | null;
    provisional: number | null;
    final: number | null;
  }[] = [];
  for (const a of assignments) {
    if (a.status === "draft") continue;
    if (f.subject && a.subject_id !== f.subject) continue;
    if (f.assignment && a.id !== f.assignment) continue;
    if (f.from && (!a.deadline || a.deadline < new Date(f.from).toISOString())) continue;
    if (f.to && (!a.deadline || a.deadline > new Date(new Date(f.to).getTime() + 86400_000 - 1).toISOString())) continue;
    const targetGroups = ag.filter((x) => x.assignment_id === a.id).map((x) => x.group_id);
    for (const st of students) {
      const myGroups = memberships.filter((m) => m.student_id === st.id).map((m) => m.group_id);
      if (f.group && !myGroups.includes(f.group)) continue;
      const targeted = myGroups.some((g) => targetGroups.includes(g));
      const sub = submissions.find((s) => s.assignment_id === a.id && s.student_id === st.id) ?? null;
      if (!targeted && !sub) continue;
      const status = deriveWorkStatus(a, targeted, sub);
      if (f.status && status !== f.status) continue;
      const myReviews = sub ? reviews.filter((r) => r.submission_id === sub.id).sort((x, y) => y.version - x.version) : [];
      const approved = myReviews.find((r) => r.status === "approved");
      items.push({
        student: st,
        groupNames: myGroups.map((g) => gMap.get(g)?.name).filter(Boolean).join(", "),
        assignment: a,
        subject: subjectName(sMap.get(a.subject_id), locale),
        status,
        submission: sub,
        provisional: myReviews[0]?.provisional_score ?? null,
        final: approved?.final_score ?? null,
      });
    }
  }
  return { items, subjects, assignments, submissions };
}

export async function buildReport(ctx: Ctx, type: ReportType, f: ReportFilters, locale: Locale, now = new Date()): Promise<Report> {
  requireStaff(ctx);
  const { items, subjects } = await workItems(ctx, f, locale);
  switch (type) {
    case "register":
      return {
        type,
        columns: [C("studentCode"), C("studentName"), C("group"), C("subject"), C("assignmentCode"), C("assignment"), C("deadline", "date"), C("status", "status")],
        rows: items.map((i) => [i.student.student_code, i.student.full_name, i.groupNames || null, i.subject, i.assignment.code, i.assignment.title, i.assignment.deadline, i.status]),
      };
    case "status":
      return {
        type,
        columns: [C("studentCode"), C("studentName"), C("assignmentCode"), C("assignment"), C("status", "status"), C("submittedAt", "date"), C("version", "number"), C("late", "bool")],
        rows: items.map((i) => [
          i.student.student_code,
          i.student.full_name,
          i.assignment.code,
          i.assignment.title,
          i.status,
          i.submission?.submitted_at ?? null,
          i.submission?.current_version ?? null,
          i.submission ? i.submission.is_late : null,
        ]),
      };
    case "outstanding": {
      const nowIso = now.toISOString();
      const open = items.filter((i) => i.status === "assigned" || i.status === "revision_required");
      return {
        type,
        columns: [C("studentCode"), C("studentName"), C("group"), C("assignmentCode"), C("assignment"), C("status", "status"), C("deadline", "date"), C("daysOverdue", "number")],
        rows: open.map((i) => {
          const due = i.status === "revision_required" ? i.submission?.revision_deadline ?? i.assignment.deadline : i.assignment.deadline;
          const overdue = due && due < nowIso ? Math.floor((now.getTime() - new Date(due).getTime()) / 86400_000) : null;
          return [i.student.student_code, i.student.full_name, i.groupNames || null, i.assignment.code, i.assignment.title, i.status, due, overdue];
        }),
      };
    }
    case "grades":
      return {
        type,
        columns: [C("studentCode"), C("studentName"), C("subject"), C("assignmentCode"), C("assignment"), C("provisional", "number"), C("final", "number"), C("maxScore", "number"), C("percent", "number")],
        rows: items
          .filter((i) => i.submission)
          .map((i) => [i.student.student_code, i.student.full_name, i.subject, i.assignment.code, i.assignment.title, i.provisional, i.final, i.assignment.max_score, pct(i.final, i.assignment.max_score)]),
      };
    case "progress": {
      const byStudent = new Map<string, typeof items>();
      for (const i of items) byStudent.set(i.student.id, [...(byStudent.get(i.student.id) ?? []), i]);
      return {
        type,
        columns: [C("studentCode"), C("studentName"), C("group"), C("assigned", "number"), C("submitted", "number"), C("graded", "number"), C("outstanding", "number"), C("completionRate", "number"), C("average", "number")],
        rows: [...byStudent.values()].map((list) => {
          const st = list[0].student;
          const submitted = list.filter((i) => i.submission).length;
          const graded = list.filter((i) => i.final !== null).length;
          const outstanding = list.filter((i) => i.status === "assigned" || i.status === "revision_required").length;
          return [
            st.student_code,
            st.full_name,
            list[0].groupNames || null,
            list.length,
            submitted,
            graded,
            outstanding,
            list.length ? Math.round((submitted / list.length) * 1000) / 10 : null,
            avg(list.map((i) => pct(i.final, i.assignment.max_score))),
          ];
        }),
      };
    }
    case "subjects": {
      return {
        type,
        columns: [C("subject"), C("assignments", "number"), C("assigned", "number"), C("submitted", "number"), C("graded", "number"), C("average", "number"), C("minimum", "number"), C("maximum", "number")],
        rows: subjects
          .filter((s) => !f.subject || s.id === f.subject)
          .map((s) => {
            const list = items.filter((i) => i.assignment.subject_id === s.id);
            const percents = list.map((i) => pct(i.final, i.assignment.max_score)).filter((p): p is number => p !== null);
            return [
              subjectName(s, locale),
              new Set(list.map((i) => i.assignment.id)).size,
              list.length,
              list.filter((i) => i.submission).length,
              percents.length,
              avg(percents),
              percents.length ? Math.min(...percents) : null,
              percents.length ? Math.max(...percents) : null,
            ];
          }),
      };
    }
  }
}
