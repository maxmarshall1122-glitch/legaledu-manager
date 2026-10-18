import { z } from "zod";
import { ASSIGNMENT_TYPES, ENROLLMENT_STATUSES, SUBMISSION_STATUSES } from "@/lib/types";

// Shared by client forms (React Hook Form + zodResolver) and server actions.
// Messages are translation keys; the UI translates them.

const R = "validation.required";
const id = z.guid({ error: "validation.invalidSelection" });
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "validation.tooLong")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);
const requiredText = (max: number) => z.string().trim().min(1, R).max(max, "validation.tooLong");
const academicYear = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{4}$/, "validation.invalidYear")
  .refine((v) => Number(v.slice(5)) === Number(v.slice(0, 4)) + 1, "validation.invalidYear");
const isoDateTime = z
  .string()
  .trim()
  .refine((v) => v === "" || !Number.isNaN(Date.parse(v)), "validation.invalidDate")
  .transform((v) => (v === "" ? null : new Date(v).toISOString()))
  .nullable()
  .optional()
  .transform((v) => v ?? null);
const num = (msg = "validation.invalidNumber") => z.coerce.number({ error: msg }).refine(Number.isFinite, msg);

export const codeSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9-]{2,31}$/, "validation.invalidCode");

export const studentSchema = z.object({
  student_code: codeSchema.transform((v) => v.toUpperCase()),
  full_name: requiredText(120),
  email: z
    .string()
    .trim()
    .max(254, "validation.tooLong")
    .refine((v) => v === "" || z.email().safeParse(v).success, "validation.invalidEmail")
    .transform((v) => (v === "" ? null : v.toLowerCase()))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  academic_year: academicYear,
  enrollment_status: z.enum(ENROLLMENT_STATUSES, { error: "validation.invalidSelection" }),
  notes: optionalText(1000),
  group_ids: z.array(id).max(20).default([]),
});
export type StudentInput = z.input<typeof studentSchema>;

export const groupSchema = z.object({
  name: requiredText(60),
  academic_year: academicYear,
  description: optionalText(500),
});
export type GroupInput = z.input<typeof groupSchema>;

export const subjectSchema = z.object({
  code: codeSchema.transform((v) => v.toUpperCase()),
  name_uz: requiredText(160),
  name_en: requiredText(160),
  description_uz: optionalText(2000),
  description_en: optionalText(2000),
  group_ids: z.array(id).max(200).default([]),
});
export type SubjectInput = z.input<typeof subjectSchema>;

export const criterionSchema = z.object({
  id: id.optional(),
  title: requiredText(160),
  description: optionalText(500),
  max_points: num().refine((v) => v > 0 && v <= 1000, "validation.positive"),
  weight: num().refine((v) => v > 0 && v <= 1000, "validation.positive"),
});

export const assignmentSchema = z
  .object({
    title: requiredText(200),
    subject_id: id,
    group_ids: z.array(id).max(200).default([]),
    description: optionalText(5000),
    instructions: optionalText(20000),
    language: z.enum(["uz", "en"], { error: "validation.invalidSelection" }),
    assignment_type: z.enum(ASSIGNMENT_TYPES, { error: "validation.invalidSelection" }),
    issue_date: isoDateTime,
    deadline: isoDateTime,
    max_score: num().refine((v) => v > 0 && v <= 1000, "validation.positive"),
    criteria: z.array(criterionSchema).min(1, "validation.atLeastOneCriterion").max(30),
    material_ids: z.array(id).max(100).default([]),
  })
  .refine((a) => !a.issue_date || !a.deadline || a.deadline > a.issue_date, {
    path: ["deadline"],
    message: "validation.deadlineBeforeIssue",
  });
export type AssignmentInput = z.input<typeof assignmentSchema>;
export type AssignmentData = z.output<typeof assignmentSchema>;

export const reviewSchema = z.object({
  submission_id: id,
  scores: z
    .array(
      z.object({
        criterion_id: id,
        // null must be matched before coercion, otherwise an empty score would become 0
        score: z.union([z.null(), num()]),
        comment: optionalText(2000),
      }),
    )
    .max(30),
  strengths: optionalText(5000),
  improvements: optionalText(5000),
  student_feedback: optionalText(8000),
  ai_suggestion_id: id.nullable().optional().transform((v) => v ?? null),
  final_override: z
    .union([z.literal(""), z.null(), num()])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  override_reason: optionalText(1000),
  revision_deadline: isoDateTime,
});
export type ReviewInput = z.input<typeof reviewSchema>;
export type ReviewData = z.output<typeof reviewSchema>;

export const changeFinalSchema = z.object({
  submission_id: id,
  new_score: num(),
  reason: z.string().trim().min(3, "validation.reasonRequired").max(1000, "validation.tooLong"),
});

export const materialSchema = z.object({
  title: requiredText(200),
  subject_id: id,
  assignment_id: z
    .union([id, z.literal("")])
    .nullable()
    .optional()
    .transform((v) => v || null),
  description: optionalText(2000),
  external_url: z
    .string()
    .trim()
    .max(2000, "validation.tooLong")
    .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "validation.invalidUrl")
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  visible_to_students: z.coerce.boolean().default(false),
});

export const followUpSchema = z.object({
  submission_id: id,
  follow_up_note: optionalText(1000),
  follow_up_due: isoDateTime,
});

export const submissionStatusSchema = z.enum(SUBMISSION_STATUSES);

/** Flattens Zod issues into { "field.path": "translation key" }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
