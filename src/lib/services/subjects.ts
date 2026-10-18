import { invalid } from "@/lib/errors";
import { RepoError } from "@/lib/db/repo";
import type { Subject } from "@/lib/types";
import { fieldErrors, subjectSchema, type SubjectInput } from "@/lib/validation";
import { audit, avg, byId, mustGet, pct, requireStaff, type Ctx } from "./core";

async function stats(ctx: Ctx) {
  const [subjects, assignments, submissions, reviews, subjectGroups, groups, materials] = await Promise.all([
    ctx.repo.list("subjects", { order: { column: "code" } }),
    ctx.repo.list("assignments"),
    ctx.repo.list("submissions"),
    ctx.repo.list("reviews", { eq: { status: "approved" } }),
    ctx.repo.list("subject_groups"),
    ctx.repo.list("groups"),
    ctx.repo.list("teaching_materials"),
  ]);
  const groupMap = byId(groups);
  const assignmentMap = byId(assignments);
  return subjects.map((s) => {
    const own = assignments.filter((a) => a.subject_id === s.id);
    const ownIds = new Set(own.map((a) => a.id));
    const subs = submissions.filter((x) => ownIds.has(x.assignment_id));
    const subIds = new Set(subs.map((x) => x.id));
    // latest approved review per submission
    const latest = new Map<string, (typeof reviews)[number]>();
    for (const r of reviews) {
      if (!subIds.has(r.submission_id)) continue;
      const prev = latest.get(r.submission_id);
      if (!prev || r.version > prev.version) latest.set(r.submission_id, r);
    }
    const percents = [...latest.values()].map((r) => {
      const sub = subs.find((x) => x.id === r.submission_id)!;
      return pct(r.final_score, assignmentMap.get(sub.assignment_id)!.max_score);
    });
    return {
      subject: s,
      groups: subjectGroups.filter((g) => g.subject_id === s.id).map((g) => groupMap.get(g.group_id)!).filter(Boolean),
      assignmentCount: own.length,
      submissionCount: subs.length,
      gradedCount: subs.filter((x) => x.status === "graded" || x.status === "completed").length,
      averagePercent: avg(percents),
      materialCount: materials.filter((m) => m.subject_id === s.id).length,
    };
  });
}

export async function listSubjectsWithStats(ctx: Ctx) {
  requireStaff(ctx);
  return stats(ctx);
}

/** Subjects are non-confidential reference data; any signed-in user may read names. */
export async function listSubjects(ctx: Ctx): Promise<Subject[]> {
  return ctx.repo.list("subjects", { order: { column: "code" } });
}

export async function getSubjectDetail(ctx: Ctx, id: string) {
  requireStaff(ctx);
  await mustGet(ctx, "subjects", id);
  const all = await stats(ctx);
  const s = all.find((x) => x.subject.id === id)!;
  const [assignments, materials, groups] = await Promise.all([
    ctx.repo.list("assignments", { eq: { subject_id: id }, order: { column: "deadline" } }),
    ctx.repo.list("teaching_materials", { eq: { subject_id: id }, order: { column: "created_at", ascending: false } }),
    ctx.repo.list("groups", { order: { column: "name" } }),
  ]);
  return { ...s, assignments, materials, allGroups: groups };
}

function parse(input: SubjectInput) {
  const parsed = subjectSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  return parsed.data;
}

async function setGroups(ctx: Ctx, subjectId: string, groupIds: string[]) {
  const current = await ctx.repo.list("subject_groups", { eq: { subject_id: subjectId } });
  for (const g of current) if (!groupIds.includes(g.group_id)) await ctx.repo.remove("subject_groups", g.id);
  for (const gid of groupIds) {
    if (!current.some((g) => g.group_id === gid)) await ctx.repo.insert("subject_groups", { subject_id: subjectId, group_id: gid });
  }
}

const wrapUnique = (e: unknown): never => {
  if (e instanceof RepoError && e.code === "unique_violation") throw invalid("subjects.duplicateCode", { code: "subjects.duplicateCode" });
  throw e;
};

export async function createSubject(ctx: Ctx, input: SubjectInput): Promise<Subject> {
  requireStaff(ctx);
  const { group_ids, ...data } = parse(input);
  const s = await ctx.repo.insert("subjects", { ...data, is_default: false }).catch(wrapUnique);
  await setGroups(ctx, s.id, group_ids);
  await audit(ctx, "subject.create", "subjects", s.id, { code: s.code });
  return s;
}

export async function updateSubject(ctx: Ctx, id: string, input: SubjectInput): Promise<Subject> {
  requireStaff(ctx);
  await mustGet(ctx, "subjects", id);
  const { group_ids, ...data } = parse(input);
  const s = await ctx.repo.update("subjects", id, data).catch(wrapUnique);
  await setGroups(ctx, id, group_ids);
  await audit(ctx, "subject.update", "subjects", id, { code: s.code });
  return s;
}

export async function deleteSubject(ctx: Ctx, id: string): Promise<void> {
  requireStaff(ctx);
  const s = await mustGet(ctx, "subjects", id);
  const assignments = await ctx.repo.list("assignments", { eq: { subject_id: id }, limit: 1 });
  if (assignments.length > 0) throw invalid("subjects.cannotDeleteWithAssignments");
  const materials = await ctx.repo.list("teaching_materials", { eq: { subject_id: id } });
  await ctx.repo.remove("subjects", id);
  await ctx.storage.remove(materials.map((m) => m.storage_key).filter((k): k is string => Boolean(k)));
  await audit(ctx, "subject.delete", "subjects", id, { code: s.code });
}
