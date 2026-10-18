import { randomUUID } from "node:crypto";
import { invalid, notFound } from "@/lib/errors";
import { validateUpload } from "@/lib/files/validate";
import type { TeachingMaterial } from "@/lib/types";
import { fieldErrors, materialSchema } from "@/lib/validation";
import { audit, byId, isStaff, mustGet, requireStaff, studentCanSeeAssignment, studentGroupIds, type Ctx } from "./core";
import type { UploadFile } from "./submissions";

export async function listMaterials(ctx: Ctx, p: { subject?: string } = {}) {
  requireStaff(ctx);
  const [materials, subjects, assignments] = await Promise.all([
    ctx.repo.list("teaching_materials", { order: { column: "created_at", ascending: false } }),
    ctx.repo.list("subjects", { order: { column: "code" } }),
    ctx.repo.list("assignments"),
  ]);
  const sMap = byId(subjects);
  const aMap = byId(assignments);
  return materials
    .filter((m) => !p.subject || m.subject_id === p.subject)
    .map((m) => ({ material: m, subject: sMap.get(m.subject_id) ?? null, assignment: m.assignment_id ? aMap.get(m.assignment_id) ?? null : null }));
}

export async function createMaterial(ctx: Ctx, input: unknown, file: UploadFile | null, maxBytes: number): Promise<TeachingMaterial> {
  requireStaff(ctx);
  const parsed = materialSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  const data = parsed.data;
  await mustGet(ctx, "subjects", data.subject_id);
  if (data.assignment_id) {
    const a = await mustGet(ctx, "assignments", data.assignment_id);
    if (a.subject_id !== data.subject_id) throw invalid("validation.invalidSelection", { assignment_id: "validation.invalidSelection" });
  }
  if (!file && !data.external_url) throw invalid("materials.fileOrLink", { file: "materials.fileOrLink" });

  let stored: { key: string; name: string; mime: string; size: number } | null = null;
  if (file) {
    const res = await validateUpload(file.name, file.type, file.bytes, maxBytes);
    if (!res.ok) throw invalid(res.error, { file: res.error });
    const key = `materials/${randomUUID()}/${randomUUID()}.${res.ext}`;
    await ctx.storage.put(key, file.bytes, res.mime);
    stored = { key, name: res.safeName, mime: res.mime, size: file.bytes.byteLength };
  }
  try {
    const m = await ctx.repo.insert("teaching_materials", {
      ...data,
      storage_key: stored?.key ?? null,
      original_name: stored?.name ?? null,
      mime_type: stored?.mime ?? null,
      size_bytes: stored?.size ?? null,
      uploaded_by: ctx.user.id,
    });
    await audit(ctx, "material.create", "teaching_materials", m.id, { title: m.title });
    return m;
  } catch (e) {
    if (stored) await ctx.storage.remove([stored.key]).catch(() => undefined);
    throw e;
  }
}

export async function setMaterialVisibility(ctx: Ctx, id: string, visible: boolean) {
  requireStaff(ctx);
  await mustGet(ctx, "teaching_materials", id);
  await ctx.repo.update("teaching_materials", id, { visible_to_students: visible });
  await audit(ctx, "material.visibility", "teaching_materials", id, { visible });
}

export async function deleteMaterial(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const m = await mustGet(ctx, "teaching_materials", id);
  await ctx.repo.remove("teaching_materials", id);
  if (m.storage_key) await ctx.storage.remove([m.storage_key]);
  await audit(ctx, "material.delete", "teaching_materials", id, { title: m.title });
}

/**
 * Staff may download any material. Students only materials marked visible
 * that belong to a subject assigned to their group or to an assignment they can see.
 */
export async function readAuthorizedMaterial(ctx: Ctx, id: string) {
  const m = await ctx.repo.get("teaching_materials", id);
  if (!m || !m.storage_key) throw notFound();
  if (!isStaff(ctx.user)) {
    if (ctx.user.role !== "student" || !ctx.user.student_id || !m.visible_to_students) throw notFound();
    let allowed = false;
    if (m.assignment_id) {
      const a = await ctx.repo.get("assignments", m.assignment_id);
      allowed = Boolean(a && (await studentCanSeeAssignment(ctx, ctx.user.student_id, a)));
    }
    if (!allowed) {
      const groups = await studentGroupIds(ctx, ctx.user.student_id);
      const sg = await ctx.repo.list("subject_groups", { eq: { subject_id: m.subject_id } });
      allowed = sg.some((x) => groups.includes(x.group_id));
    }
    if (!allowed) throw notFound();
  }
  return { material: m, bytes: await ctx.storage.get(m.storage_key) };
}
