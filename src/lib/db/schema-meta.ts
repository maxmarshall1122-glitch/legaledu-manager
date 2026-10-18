import type { TableName } from "@/lib/types";

/**
 * Relational metadata mirrored from supabase/migrations/0001_init.sql.
 * The demo/memory repository uses it to enforce the same unique and foreign-key
 * rules (including ON DELETE behaviour) that PostgreSQL enforces in production.
 */
export interface ForeignKey {
  table: TableName;
  column: string;
  references: TableName;
  onDelete: "cascade" | "set null" | "restrict";
}

export const FOREIGN_KEYS: ForeignKey[] = [
  { table: "students", column: "profile_id", references: "profiles", onDelete: "set null" },
  { table: "group_memberships", column: "group_id", references: "groups", onDelete: "cascade" },
  { table: "group_memberships", column: "student_id", references: "students", onDelete: "cascade" },
  { table: "subject_groups", column: "subject_id", references: "subjects", onDelete: "cascade" },
  { table: "subject_groups", column: "group_id", references: "groups", onDelete: "cascade" },
  { table: "assignments", column: "subject_id", references: "subjects", onDelete: "restrict" },
  { table: "assignments", column: "created_by", references: "profiles", onDelete: "set null" },
  { table: "assignment_groups", column: "assignment_id", references: "assignments", onDelete: "cascade" },
  { table: "assignment_groups", column: "group_id", references: "groups", onDelete: "cascade" },
  { table: "rubric_criteria", column: "assignment_id", references: "assignments", onDelete: "cascade" },
  { table: "submissions", column: "assignment_id", references: "assignments", onDelete: "cascade" },
  { table: "submissions", column: "student_id", references: "students", onDelete: "cascade" },
  { table: "submission_files", column: "submission_id", references: "submissions", onDelete: "cascade" },
  { table: "submission_files", column: "uploaded_by", references: "profiles", onDelete: "set null" },
  { table: "reviews", column: "submission_id", references: "submissions", onDelete: "cascade" },
  { table: "reviews", column: "reviewer_id", references: "profiles", onDelete: "set null" },
  { table: "reviews", column: "approved_by", references: "profiles", onDelete: "set null" },
  { table: "reviews", column: "ai_suggestion_id", references: "ai_suggestions", onDelete: "set null" },
  { table: "rubric_scores", column: "review_id", references: "reviews", onDelete: "cascade" },
  { table: "rubric_scores", column: "criterion_id", references: "rubric_criteria", onDelete: "cascade" },
  { table: "feedback", column: "review_id", references: "reviews", onDelete: "cascade" },
  { table: "feedback", column: "submission_id", references: "submissions", onDelete: "cascade" },
  { table: "grade_history", column: "submission_id", references: "submissions", onDelete: "cascade" },
  { table: "grade_history", column: "review_id", references: "reviews", onDelete: "set null" },
  { table: "grade_history", column: "changed_by", references: "profiles", onDelete: "set null" },
  { table: "teaching_materials", column: "subject_id", references: "subjects", onDelete: "cascade" },
  { table: "teaching_materials", column: "assignment_id", references: "assignments", onDelete: "set null" },
  { table: "teaching_materials", column: "uploaded_by", references: "profiles", onDelete: "set null" },
  { table: "audit_logs", column: "actor_id", references: "profiles", onDelete: "set null" },
  { table: "ai_suggestions", column: "submission_id", references: "submissions", onDelete: "cascade" },
  { table: "ai_suggestions", column: "requested_by", references: "profiles", onDelete: "set null" },
  { table: "ai_suggestions", column: "decided_by", references: "profiles", onDelete: "set null" },
];

/** Unique constraints (column sets). Single-column primary key `id` is implicit. */
export const UNIQUE_KEYS: Partial<Record<TableName, string[][]>> = {
  students: [["student_code"], ["profile_id"]],
  groups: [["name"]],
  subjects: [["code"]],
  assignments: [["code"]],
  submissions: [["code"], ["assignment_id", "student_id"]],
  group_memberships: [["group_id", "student_id"]],
  subject_groups: [["subject_id", "group_id"]],
  assignment_groups: [["assignment_id", "group_id"]],
  rubric_scores: [["review_id", "criterion_id"]],
  submission_files: [["storage_key"]],
  feedback: [["review_id"]],
};

/** Tables that carry an updated_at column. */
export const HAS_UPDATED_AT = new Set<TableName>([
  "profiles",
  "students",
  "groups",
  "subjects",
  "assignments",
  "rubric_criteria",
  "submissions",
  "reviews",
  "feedback",
  "teaching_materials",
]);
