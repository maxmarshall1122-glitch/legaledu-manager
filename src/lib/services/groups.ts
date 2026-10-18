import { invalid } from "@/lib/errors";
import { RepoError } from "@/lib/db/repo";
import type { Group } from "@/lib/types";
import { fieldErrors, groupSchema, type GroupInput } from "@/lib/validation";
import { audit, byId, mustGet, requireStaff, type Ctx } from "./core";

export async function listGroups(ctx: Ctx) {
  requireStaff(ctx);
  const [groups, memberships, subjectGroups] = await Promise.all([
    ctx.repo.list("groups", { order: { column: "name" } }),
    ctx.repo.list("group_memberships"),
    ctx.repo.list("subject_groups"),
  ]);
  return groups.map((g) => ({
    ...g,
    studentCount: memberships.filter((m) => m.group_id === g.id).length,
    subjectCount: subjectGroups.filter((s) => s.group_id === g.id).length,
  }));
}

export async function getGroupDetail(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const group = await mustGet(ctx, "groups", id);
  const [memberships, students, subjectGroups, subjects] = await Promise.all([
    ctx.repo.list("group_memberships", { eq: { group_id: id } }),
    ctx.repo.list("students", { order: { column: "student_code" } }),
    ctx.repo.list("subject_groups", { eq: { group_id: id } }),
    ctx.repo.list("subjects"),
  ]);
  const memberIds = new Set(memberships.map((m) => m.student_id));
  const subjectMap = byId(subjects);
  return {
    group,
    members: students.filter((s) => memberIds.has(s.id)),
    nonMembers: students.filter((s) => !memberIds.has(s.id)),
    subjects: subjectGroups.map((sg) => subjectMap.get(sg.subject_id)).filter((s) => s !== undefined),
  };
}

function parse(input: GroupInput) {
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  return parsed.data;
}

async function assertNameFree(ctx: Ctx, name: string, exceptId?: string) {
  const all = await ctx.repo.list("groups");
  if (all.some((g) => g.id !== exceptId && g.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw invalid("groups.duplicateName", { name: "groups.duplicateName" });
  }
}

const wrapUnique = (e: unknown): never => {
  if (e instanceof RepoError && e.code === "unique_violation") throw invalid("groups.duplicateName", { name: "groups.duplicateName" });
  throw e;
};

export async function createGroup(ctx: Ctx, input: GroupInput): Promise<Group> {
  requireStaff(ctx);
  const data = parse(input);
  await assertNameFree(ctx, data.name);
  const g = await ctx.repo.insert("groups", data).catch(wrapUnique);
  await audit(ctx, "group.create", "groups", g.id, { name: g.name });
  return g;
}

export async function updateGroup(ctx: Ctx, id: string, input: GroupInput): Promise<Group> {
  requireStaff(ctx);
  await mustGet(ctx, "groups", id);
  const data = parse(input);
  await assertNameFree(ctx, data.name, id);
  const g = await ctx.repo.update("groups", id, data).catch(wrapUnique);
  await audit(ctx, "group.update", "groups", id, { name: g.name });
  return g;
}

export async function deleteGroup(ctx: Ctx, id: string): Promise<void> {
  requireStaff(ctx);
  const g = await mustGet(ctx, "groups", id);
  await ctx.repo.remove("groups", id);
  await audit(ctx, "group.delete", "groups", id, { name: g.name });
}

export async function addGroupMember(ctx: Ctx, groupId: string, studentId: string): Promise<void> {
  requireStaff(ctx);
  await mustGet(ctx, "groups", groupId);
  await mustGet(ctx, "students", studentId);
  const existing = await ctx.repo.list("group_memberships", { eq: { group_id: groupId, student_id: studentId } });
  if (existing.length === 0) await ctx.repo.insert("group_memberships", { group_id: groupId, student_id: studentId });
  await audit(ctx, "group.member_add", "groups", groupId, { student_id: studentId });
}

export async function removeGroupMember(ctx: Ctx, groupId: string, studentId: string): Promise<void> {
  requireStaff(ctx);
  const existing = await ctx.repo.list("group_memberships", { eq: { group_id: groupId, student_id: studentId } });
  for (const m of existing) await ctx.repo.remove("group_memberships", m.id);
  await audit(ctx, "group.member_remove", "groups", groupId, { student_id: studentId });
}
