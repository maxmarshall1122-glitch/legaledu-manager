import { createHash, randomUUID } from "node:crypto";
import { AppError, invalid, notFound } from "@/lib/errors";
import { extractText } from "@/lib/files/extract";
import { validateUpload, type AllowedExt } from "@/lib/files/validate";
import { rateLimit } from "@/lib/rate-limit";
import type { Submission, SubmissionFile, SubmissionStatus } from "@/lib/types";
import { fieldErrors, followUpSchema, submissionStatusSchema } from "@/lib/validation";
import {
  audit,
  byId,
  contains,
  getAuthorizedSubmission,
  isStaff,
  mustGet,
  nextCode,
  requireStaff,
  studentCanSeeAssignment,
  studentGroupIds,
  type Ctx,
} from "./core";

export interface UploadFile {
  name: string;
  type: string;
  bytes: Uint8Array;
}

export interface UploadLimits {
  maxFileBytes: number;
  maxFilesPerSubmission: number;
}

export interface SubmissionListParams {
  q?: string;
  assignment?: string;
  subject?: string;
  group?: string;
  status?: string;
  student?: string;
}

export async function listSubmissions(ctx: Ctx, p: SubmissionListParams = {}) {
  const staff = isStaff(ctx.user);
  if (!staff && !ctx.user.student_id) return [];
  const [subs, assignments, students, subjects, files, memberships] = await Promise.all([
    staff
      ? ctx.repo.list("submissions", { order: { column: "submitted_at", ascending: false } })
      : ctx.repo.list("submissions", { eq: { student_id: ctx.user.student_id! } }),
    ctx.repo.list("assignments"),
    staff ? ctx.repo.list("students") : ctx.repo.list("students", { eq: { id: ctx.user.student_id! } }),
    ctx.repo.list("subjects"),
    ctx.repo.list("submission_files"),
    p.group ? ctx.repo.list("group_memberships", { eq: { group_id: p.group } }) : Promise.resolve([]),
  ]);
  const aMap = byId(assignments);
  const sMap = byId(students);
  const subjMap = byId(subjects);
  const inGroup = new Set(memberships.map((m) => m.student_id));
  return subs
    .map((s) => {
      const a = aMap.get(s.assignment_id)!;
      const myFiles = files.filter((f) => f.submission_id === s.id);
      return {
        submission: s,
        assignment: a,
        subject: a ? subjMap.get(a.subject_id) ?? null : null,
        student: sMap.get(s.student_id) ?? null,
        fileCount: myFiles.filter((f) => f.version === s.current_version).length,
        fileNames: myFiles.map((f) => f.original_name),
      };
    })
    .filter((r) => {
      if (!r.assignment) return false;
      if (p.assignment && r.submission.assignment_id !== p.assignment) return false;
      if (p.subject && r.assignment.subject_id !== p.subject) return false;
      if (p.status && r.submission.status !== p.status) return false;
      if (p.student && r.submission.student_id !== p.student) return false;
      if (p.group && !inGroup.has(r.submission.student_id)) return false;
      if (p.q) {
        const hay = `${r.submission.code} ${r.assignment.title} ${r.assignment.code} ${r.student?.student_code ?? ""} ${r.student?.full_name ?? ""} ${r.fileNames.join(" ")}`;
        if (!contains(hay, p.q)) return false;
      }
      return true;
    });
}

export async function getSubmissionDetail(ctx: Ctx, id: string) {
  const submission = await getAuthorizedSubmission(ctx, id);
  const staff = isStaff(ctx.user);
  const [assignment, student, files, reviews, feedback, history, criteria] = await Promise.all([
    mustGet(ctx, "assignments", submission.assignment_id),
    ctx.repo.get("students", submission.student_id),
    ctx.repo.list("submission_files", { eq: { submission_id: id }, order: { column: "created_at" } }),
    ctx.repo.list("reviews", { eq: { submission_id: id }, order: { column: "version" } }),
    ctx.repo.list("feedback", { eq: { submission_id: id } }),
    staff ? ctx.repo.list("grade_history", { eq: { submission_id: id }, order: { column: "created_at" } }) : Promise.resolve([]),
    ctx.repo.list("rubric_criteria", { eq: { assignment_id: submission.assignment_id }, order: { column: "position" } }),
  ]);
  const subject = await ctx.repo.get("subjects", assignment.subject_id);
  const profileIds = [...new Set([...reviews.map((r) => r.reviewer_id), ...reviews.map((r) => r.approved_by), ...history.map((h) => h.changed_by)].filter((x): x is string => Boolean(x)))];
  const profiles = staff && profileIds.length ? await ctx.repo.list("profiles", { in: { column: "id", values: profileIds } }) : [];
  const scores = staff && reviews.length ? await ctx.repo.list("rubric_scores", { in: { column: "review_id", values: reviews.map((r) => r.id) } }) : [];
  const versions = [...new Set(files.map((f) => f.version))].sort((a, b) => b - a);
  return {
    submission,
    assignment,
    subject,
    student,
    criteria,
    filesByVersion: versions.map((v) => ({ version: v, files: files.filter((f) => f.version === v) })),
    reviews: staff ? reviews : reviews.filter((r) => feedback.some((f) => f.review_id === r.id && f.released)),
    feedback: staff ? feedback : feedback.filter((f) => f.released),
    scores,
    history,
    profiles: byId(profiles),
  };
}

/**
 * Upload (or resubmit) work. Students may only submit for themselves to a
 * published assignment that targets their group; staff may upload on behalf
 * of a student. Earlier versions are always preserved.
 */
export async function uploadSubmission(
  ctx: Ctx,
  input: { assignment_id: string; student_id?: string | null; comment?: string | null; files: UploadFile[] },
  limits: UploadLimits,
): Promise<Submission> {
  const staff = isStaff(ctx.user);
  const studentId = staff ? input.student_id : ctx.user.student_id;
  if (!studentId) throw invalid("validation.required", { student_id: "validation.required" });
  if (!staff && input.student_id && input.student_id !== ctx.user.student_id) throw notFound();

  const rl = rateLimit(`upload:${ctx.user.id}`, 20, 60_000);
  if (!rl.ok) throw new AppError("rate_limited", "errors.rateLimited");

  const assignment = await ctx.repo.get("assignments", input.assignment_id);
  if (!assignment) throw notFound();
  await mustGet(ctx, "students", studentId);
  if (!staff && !(await studentCanSeeAssignment(ctx, studentId, assignment))) throw notFound();
  if (assignment.status === "archived" || (!staff && assignment.status !== "published")) {
    throw invalid("submissions.notAccepting");
  }

  const existing = (await ctx.repo.list("submissions", { eq: { assignment_id: assignment.id, student_id: studentId } }))[0] ?? null;
  if (!staff && existing && ["under_review", "graded", "completed"].includes(existing.status)) {
    throw invalid("submissions.notAccepting");
  }

  if (input.files.length === 0) throw invalid("validation.fileRequired", { files: "validation.fileRequired" });
  if (input.files.length > limits.maxFilesPerSubmission) {
    throw invalid(`validation.tooManyFiles|${JSON.stringify({ n: limits.maxFilesPerSubmission })}`);
  }
  const checked: { file: UploadFile; ext: AllowedExt; mime: string; safeName: string }[] = [];
  for (const f of input.files) {
    const res = await validateUpload(f.name, f.type, f.bytes, limits.maxFileBytes);
    if (!res.ok) throw invalid(res.error, { files: res.error });
    checked.push({ file: f, ext: res.ext, mime: res.mime, safeName: res.safeName });
  }
  const comment = input.comment?.trim().slice(0, 2000) || null;

  const submissionId = existing?.id ?? randomUUID();
  const version = existing ? existing.current_version + 1 : 1;
  const now = new Date();
  const deadline = existing?.status === "revision_required" && existing.revision_deadline ? existing.revision_deadline : assignment.deadline;
  const isLate = Boolean(deadline && now.toISOString() > deadline);

  // 1) Store objects under server-generated keys (no user-controlled path components).
  const stored: { key: string; c: (typeof checked)[number]; sha256: string }[] = [];
  try {
    for (const c of checked) {
      const key = `submissions/${submissionId}/${randomUUID()}.${c.ext}`;
      await ctx.storage.put(key, c.file.bytes, c.mime);
      stored.push({ key, c, sha256: createHash("sha256").update(c.file.bytes).digest("hex") });
    }
    // 2) Record metadata.
    let submission: Submission;
    if (existing) {
      submission = await ctx.repo.update("submissions", existing.id, {
        current_version: version,
        status: existing.status === "revision_required" ? "resubmitted" : existing.status === "submitted" ? "submitted" : "resubmitted",
        submitted_at: now.toISOString(),
        is_late: isLate,
        student_comment: comment,
      });
    } else {
      submission = await ctx.repo.insert("submissions", {
        id: submissionId,
        code: await nextCode(ctx, "submissions", "SUB-", 6),
        assignment_id: assignment.id,
        student_id: studentId,
        current_version: 1,
        status: "submitted",
        student_comment: comment,
        submitted_at: now.toISOString(),
        is_late: isLate,
        revision_deadline: null,
        follow_up_note: null,
        follow_up_due: null,
      });
    }
    for (const s of stored) {
      await ctx.repo.insert("submission_files", {
        submission_id: submission.id,
        version,
        storage_key: s.key,
        original_name: s.c.safeName,
        mime_type: s.c.mime,
        size_bytes: s.c.file.bytes.byteLength,
        sha256: s.sha256,
        uploaded_by: ctx.user.id,
      });
    }
    await audit(ctx, existing ? "submission.resubmit" : "submission.create", "submissions", submission.id, {
      version,
      files: stored.length,
      on_behalf: staff,
      late: isLate,
    });
    return submission;
  } catch (e) {
    await ctx.storage.remove(stored.map((s) => s.key)).catch(() => undefined);
    throw e;
  }
}

/** Returns a file only if the caller may access its submission; otherwise "not found". */
export async function getAuthorizedFile(ctx: Ctx, fileId: string): Promise<{ file: SubmissionFile; submission: Submission }> {
  const file = await ctx.repo.get("submission_files", fileId);
  if (!file) throw notFound();
  const submission = await getAuthorizedSubmission(ctx, file.submission_id);
  return { file, submission };
}

export async function readAuthorizedFile(ctx: Ctx, fileId: string) {
  const { file } = await getAuthorizedFile(ctx, fileId);
  await audit(ctx, "file.access", "submission_files", file.id, { name: file.original_name });
  return { file, bytes: await ctx.storage.get(file.storage_key) };
}

export async function previewFileText(ctx: Ctx, fileId: string, maxChars = 100_000) {
  const { file } = await getAuthorizedFile(ctx, fileId);
  const bytes = await ctx.storage.get(file.storage_key);
  const ext = file.storage_key.split(".").pop() as AllowedExt;
  try {
    const text = await extractText(ext, bytes);
    return { file, text: text.slice(0, maxChars), truncated: text.length > maxChars };
  } catch {
    return { file, text: null, truncated: false };
  }
}

export async function setFollowUp(ctx: Ctx, input: unknown) {
  requireStaff(ctx);
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) throw invalid("validation.required", fieldErrors(parsed.error));
  await mustGet(ctx, "submissions", parsed.data.submission_id);
  await ctx.repo.update("submissions", parsed.data.submission_id, {
    follow_up_note: parsed.data.follow_up_note,
    follow_up_due: parsed.data.follow_up_due,
  });
  await audit(ctx, "submission.follow_up", "submissions", parsed.data.submission_id, null);
}

export async function setSubmissionStatus(ctx: Ctx, id: string, status: SubmissionStatus) {
  requireStaff(ctx);
  const parsed = submissionStatusSchema.safeParse(status);
  if (!parsed.success) throw invalid("validation.invalidSelection");
  const s = await mustGet(ctx, "submissions", id);
  await ctx.repo.update("submissions", id, { status: parsed.data });
  await audit(ctx, "submission.status", "submissions", id, { from: s.status, to: parsed.data });
}

export async function deleteSubmission(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const s = await mustGet(ctx, "submissions", id);
  const files = await ctx.repo.list("submission_files", { eq: { submission_id: id } });
  await ctx.repo.remove("submissions", id);
  await ctx.storage.remove(files.map((f) => f.storage_key));
  await audit(ctx, "submission.delete", "submissions", id, { code: s.code });
}

/** Staff helper for the upload form: students targeted by each assignment (three queries total). */
export async function eligibleStudentsByAssignment(ctx: Ctx, assignmentIds: string[]) {
  requireStaff(ctx);
  const out: Record<string, { id: string; student_code: string; full_name: string }[]> = {};
  if (assignmentIds.length === 0) return out;
  const [ag, memberships, students] = await Promise.all([
    ctx.repo.list("assignment_groups", { in: { column: "assignment_id", values: assignmentIds } }),
    ctx.repo.list("group_memberships"),
    ctx.repo.list("students", { order: { column: "student_code" } }),
  ]);
  for (const id of assignmentIds) {
    const groups = new Set(ag.filter((x) => x.assignment_id === id).map((x) => x.group_id));
    const ids = new Set(memberships.filter((m) => groups.has(m.group_id)).map((m) => m.student_id));
    out[id] = students.filter((st) => ids.has(st.id));
  }
  return out;
}

export { studentGroupIds };
