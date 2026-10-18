// Domain model shared by the Supabase backend and the demo backend.
// Column names match supabase/migrations exactly (snake_case).

export type Role = "admin" | "lecturer" | "student";
export type Locale = "uz" | "en";

export const ENROLLMENT_STATUSES = ["active", "on_leave", "graduated", "withdrawn"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const ASSIGNMENT_TYPES = [
  "essay",
  "case_study",
  "presentation",
  "research_paper",
  "legal_analysis",
  "language_exercise",
  "other",
] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

export const ASSIGNMENT_STATUSES = ["draft", "published", "archived"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

/** Statuses stored on a submission row. */
export const SUBMISSION_STATUSES = [
  "submitted",
  "under_review",
  "revision_required",
  "resubmitted",
  "graded",
  "completed",
] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

/** Workflow status for a (student, assignment) pair, including derived states with no submission row. */
export const WORK_STATUSES = ["not_assigned", "assigned", ...SUBMISSION_STATUSES] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const REVIEW_STATUSES = ["draft", "approved"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const AI_SUGGESTION_STATUSES = ["pending", "approved", "edited", "rejected"] as const;
export type AiSuggestionStatus = (typeof AI_SUGGESTION_STATUSES)[number];

export type AiProviderId = "anthropic" | "gemini";

interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface Profile extends Timestamps {
  id: string;
  full_name: string;
  role: Role;
  locale: Locale;
  email: string | null;
}

export interface Group extends Timestamps {
  id: string;
  name: string;
  academic_year: string;
  description: string | null;
}

export interface Student extends Timestamps {
  id: string;
  /** Internal, anonymised student code (e.g. "LAW-24-0007"). Unique. */
  student_code: string;
  full_name: string;
  email: string | null;
  academic_year: string;
  enrollment_status: EnrollmentStatus;
  notes: string | null;
  /** Auth user linked to this student record (for the student portal). */
  profile_id: string | null;
}

export interface GroupMembership {
  id: string;
  group_id: string;
  student_id: string;
  created_at: string;
}

export interface Subject extends Timestamps {
  id: string;
  code: string;
  name_uz: string;
  name_en: string;
  description_uz: string | null;
  description_en: string | null;
  is_default: boolean;
}

export interface SubjectGroup {
  id: string;
  subject_id: string;
  group_id: string;
  created_at: string;
}

export interface Assignment extends Timestamps {
  id: string;
  code: string;
  title: string;
  subject_id: string;
  description: string | null;
  instructions: string | null;
  language: Locale;
  assignment_type: AssignmentType;
  issue_date: string | null;
  deadline: string | null;
  max_score: number;
  status: AssignmentStatus;
  created_by: string | null;
}

export interface AssignmentGroup {
  id: string;
  assignment_id: string;
  group_id: string;
  created_at: string;
}

export interface RubricCriterion extends Timestamps {
  id: string;
  assignment_id: string;
  title: string;
  description: string | null;
  max_points: number;
  weight: number;
  position: number;
}

export interface Submission extends Timestamps {
  id: string;
  code: string;
  assignment_id: string;
  student_id: string;
  current_version: number;
  status: SubmissionStatus;
  student_comment: string | null;
  submitted_at: string;
  is_late: boolean;
  revision_deadline: string | null;
  follow_up_note: string | null;
  follow_up_due: string | null;
}

export interface SubmissionFile {
  id: string;
  submission_id: string;
  version: number;
  storage_key: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  uploaded_by: string | null;
  created_at: string;
}

export interface Review extends Timestamps {
  id: string;
  submission_id: string;
  version: number;
  reviewer_id: string | null;
  status: ReviewStatus;
  provisional_score: number | null;
  final_score: number | null;
  revision_requested: boolean;
  revision_deadline: string | null;
  ai_suggestion_id: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
}

export interface RubricScore {
  id: string;
  review_id: string;
  criterion_id: string;
  score: number;
  comment: string | null;
  created_at: string;
}

export interface Feedback extends Timestamps {
  id: string;
  review_id: string;
  submission_id: string;
  strengths: string | null;
  improvements: string | null;
  student_feedback: string | null;
  /** Students may only read feedback once it is released (on approval or revision request). */
  released: boolean;
}

export interface GradeHistory {
  id: string;
  submission_id: string;
  review_id: string | null;
  kind: "provisional" | "final";
  old_score: number | null;
  new_score: number | null;
  reason: string | null;
  changed_by: string | null;
  created_at: string;
}

export interface TeachingMaterial extends Timestamps {
  id: string;
  subject_id: string;
  assignment_id: string | null;
  title: string;
  description: string | null;
  storage_key: string | null;
  original_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  external_url: string | null;
  visible_to_students: boolean;
  uploaded_by: string | null;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AiSuggestion {
  id: string;
  submission_id: string;
  version: number;
  provider: AiProviderId;
  model: string;
  status: AiSuggestionStatus;
  /** Raw provider output, stored separately and never shown to students. */
  raw_response: unknown;
  /** Validated, structured suggestion. */
  parsed: AiReviewResult | null;
  error: string | null;
  requested_by: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface AiReviewResult {
  criteria: { criterion_id: string; suggested_score: number; evidence: string; comment: string }[];
  strengths: string;
  improvements: string;
  student_feedback: string;
  provisional_total: number;
  caveats: string;
  /** Character limit at which the document text was cut, if it was. */
  truncated_at?: number | null;
}

export interface TableMap {
  profiles: Profile;
  students: Student;
  groups: Group;
  group_memberships: GroupMembership;
  subjects: Subject;
  subject_groups: SubjectGroup;
  assignments: Assignment;
  assignment_groups: AssignmentGroup;
  rubric_criteria: RubricCriterion;
  submissions: Submission;
  submission_files: SubmissionFile;
  reviews: Review;
  rubric_scores: RubricScore;
  feedback: Feedback;
  grade_history: GradeHistory;
  teaching_materials: TeachingMaterial;
  audit_logs: AuditLog;
  ai_suggestions: AiSuggestion;
}

export type TableName = keyof TableMap;
export type Row<T extends TableName> = TableMap[T];

export const TABLES: TableName[] = [
  "profiles",
  "students",
  "groups",
  "group_memberships",
  "subjects",
  "subject_groups",
  "assignments",
  "assignment_groups",
  "rubric_criteria",
  "submissions",
  "submission_files",
  "reviews",
  "rubric_scores",
  "feedback",
  "grade_history",
  "teaching_materials",
  "audit_logs",
  "ai_suggestions",
];

export interface SessionUser {
  id: string;
  role: Role;
  full_name: string;
  email: string | null;
  /** Set when role === "student": the linked students.id */
  student_id: string | null;
}
