-- LegalEdu Manager — core schema
-- Mirrors src/lib/types.ts and src/lib/db/schema-meta.ts (keep them in sync; tests/db verifies this).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create sequence if not exists public.assignment_code_seq;
create sequence if not exists public.submission_code_seq;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user). Role is NEVER taken from client metadata.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 200),
  role text not null default 'student' check (role in ('admin', 'lecturer', 'student')),
  locale text not null default 'uz' check (locale in ('uz', 'en')),
  email text check (email is null or char_length(email) <= 254),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email, 'student')
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Groups, students, memberships
-- ---------------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  description text check (char_length(description) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  student_code text not null unique check (student_code ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,31}$'),
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text check (email is null or char_length(email) <= 254),
  academic_year text not null check (academic_year ~ '^\d{4}-\d{4}$'),
  enrollment_status text not null default 'active' check (enrollment_status in ('active', 'on_leave', 'graduated', 'withdrawn')),
  notes text check (char_length(notes) <= 1000),
  profile_id uuid unique references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index students_full_name_idx on public.students (full_name);
create index students_academic_year_idx on public.students (academic_year);

create table public.group_memberships (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (group_id, student_id)
);
create index group_memberships_student_idx on public.group_memberships (student_id);

-- ---------------------------------------------------------------------------
-- Subjects
-- ---------------------------------------------------------------------------
create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Za-z0-9][A-Za-z0-9-]{2,31}$'),
  name_uz text not null check (char_length(name_uz) between 1 and 160),
  name_en text not null check (char_length(name_en) between 1 and 160),
  description_uz text check (char_length(description_uz) <= 2000),
  description_en text check (char_length(description_en) <= 2000),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.subject_groups (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (subject_id, group_id)
);
create index subject_groups_group_idx on public.subject_groups (group_id);

-- ---------------------------------------------------------------------------
-- Assignments and rubrics
-- ---------------------------------------------------------------------------
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('ASG-' || lpad(nextval('public.assignment_code_seq')::text, 4, '0')),
  title text not null check (char_length(title) between 1 and 200),
  subject_id uuid not null references public.subjects (id) on delete restrict,
  description text check (char_length(description) <= 5000),
  instructions text check (char_length(instructions) <= 20000),
  language text not null default 'uz' check (language in ('uz', 'en')),
  assignment_type text not null check (assignment_type in ('essay', 'case_study', 'presentation', 'research_paper', 'legal_analysis', 'language_exercise', 'other')),
  issue_date timestamptz,
  deadline timestamptz,
  max_score numeric(7, 2) not null default 100 check (max_score > 0 and max_score <= 1000),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (deadline is null or issue_date is null or deadline > issue_date),
  check (status <> 'published' or deadline is not null)
);
create index assignments_subject_idx on public.assignments (subject_id);
create index assignments_status_deadline_idx on public.assignments (status, deadline);

create table public.assignment_groups (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assignment_id, group_id)
);
create index assignment_groups_group_idx on public.assignment_groups (group_id);

create table public.rubric_criteria (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text check (char_length(description) <= 500),
  max_points numeric(7, 2) not null check (max_points > 0 and max_points <= 1000),
  weight numeric(7, 2) not null check (weight > 0 and weight <= 1000),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index rubric_criteria_assignment_idx on public.rubric_criteria (assignment_id, position);

-- ---------------------------------------------------------------------------
-- Submissions (one per student × assignment; files are versioned)
-- ---------------------------------------------------------------------------
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('SUB-' || lpad(nextval('public.submission_code_seq')::text, 6, '0')),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  current_version integer not null default 1 check (current_version >= 1),
  status text not null default 'submitted' check (status in ('submitted', 'under_review', 'revision_required', 'resubmitted', 'graded', 'completed')),
  student_comment text check (char_length(student_comment) <= 2000),
  submitted_at timestamptz not null default now(),
  is_late boolean not null default false,
  revision_deadline timestamptz,
  follow_up_note text check (char_length(follow_up_note) <= 1000),
  follow_up_due timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);
create index submissions_student_idx on public.submissions (student_id);
create index submissions_status_idx on public.submissions (status);

create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version integer not null check (version >= 1),
  storage_key text not null unique check (storage_key ~ '^(submissions|materials)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|pptx|txt)$'),
  original_name text not null check (char_length(original_name) between 1 and 180),
  mime_type text not null check (mime_type in (
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain')),
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index submission_files_submission_idx on public.submission_files (submission_id, version);
create index submission_files_name_idx on public.submission_files (lower(original_name));

-- ---------------------------------------------------------------------------
-- AI suggestions (raw provider output kept separate from approved evaluations)
-- ---------------------------------------------------------------------------
create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version integer not null check (version >= 1),
  provider text not null check (provider in ('anthropic', 'gemini')),
  model text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected')),
  raw_response jsonb,
  parsed jsonb,
  error text,
  requested_by uuid references public.profiles (id) on delete set null,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_suggestions_submission_idx on public.ai_suggestions (submission_id, created_at desc);
create index ai_suggestions_requester_idx on public.ai_suggestions (requested_by, created_at);

-- ---------------------------------------------------------------------------
-- Reviews, rubric scores, feedback, grade history
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  version integer not null check (version >= 1),
  reviewer_id uuid references public.profiles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'approved')),
  provisional_score numeric(7, 2) check (provisional_score is null or provisional_score >= 0),
  final_score numeric(7, 2) check (final_score is null or final_score >= 0),
  revision_requested boolean not null default false,
  revision_deadline timestamptz,
  ai_suggestion_id uuid references public.ai_suggestions (id) on delete set null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, version),
  check (status <> 'approved' or (final_score is not null and approved_at is not null))
);

create table public.rubric_scores (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  criterion_id uuid not null references public.rubric_criteria (id) on delete cascade,
  score numeric(7, 2) not null check (score >= 0),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (review_id, criterion_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  submission_id uuid not null references public.submissions (id) on delete cascade,
  strengths text check (char_length(strengths) <= 5000),
  improvements text check (char_length(improvements) <= 5000),
  student_feedback text check (char_length(student_feedback) <= 8000),
  released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index feedback_submission_idx on public.feedback (submission_id);

create table public.grade_history (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  review_id uuid references public.reviews (id) on delete set null,
  kind text not null check (kind in ('provisional', 'final')),
  old_score numeric(7, 2),
  new_score numeric(7, 2),
  reason text check (char_length(reason) <= 1000),
  changed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index grade_history_submission_idx on public.grade_history (submission_id, created_at);

-- ---------------------------------------------------------------------------
-- Teaching materials
-- ---------------------------------------------------------------------------
create table public.teaching_materials (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references public.subjects (id) on delete cascade,
  assignment_id uuid references public.assignments (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 2000),
  storage_key text unique check (storage_key is null or storage_key ~ '^materials/[0-9a-f-]{36}/[0-9a-f-]{36}\.(pdf|docx|pptx|txt)$'),
  original_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes > 0),
  external_url text check (external_url is null or external_url ~* '^https://[^\s]+$'),
  visible_to_students boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_key is not null or external_url is not null)
);
create index teaching_materials_subject_idx on public.teaching_materials (subject_id);
create index teaching_materials_assignment_idx on public.teaching_materials (assignment_id);

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null check (char_length(action) <= 100),
  entity text not null check (char_length(entity) <= 100),
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','students','groups','subjects','assignments','rubric_criteria','submissions','reviews','feedback','teaching_materials']
  loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Integrity triggers (defence in depth: the application validates the same rules)
-- ---------------------------------------------------------------------------

-- A rubric score may not exceed its criterion's maximum.
create or replace function public.check_rubric_score() returns trigger
language plpgsql as $$
declare maxp numeric;
begin
  select max_points into maxp from public.rubric_criteria where id = new.criterion_id;
  if new.score > maxp then
    raise exception 'score % exceeds criterion maximum %', new.score, maxp using errcode = '23514';
  end if;
  return new;
end $$;
create trigger rubric_scores_range before insert or update on public.rubric_scores
  for each row execute function public.check_rubric_score();

-- Provisional/final scores may not exceed the assignment maximum.
create or replace function public.check_review_score() returns trigger
language plpgsql as $$
declare maxs numeric;
begin
  select a.max_score into maxs from public.submissions s join public.assignments a on a.id = s.assignment_id where s.id = new.submission_id;
  if coalesce(new.final_score, 0) > maxs or coalesce(new.provisional_score, 0) > maxs then
    raise exception 'score exceeds assignment maximum %', maxs using errcode = '23514';
  end if;
  return new;
end $$;
create trigger reviews_score_range before insert or update on public.reviews
  for each row execute function public.check_review_score();

-- Keep code sequences ahead of explicitly supplied codes (imports, seed scripts),
-- so later sequence defaults can never collide.
create or replace function public.sync_code_sequence() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  n bigint := nullif(substring(new.code from '(\d+)$'), '')::bigint;
  seq regclass := tg_argv[0]::regclass;
begin
  if n is not null then
    perform setval(seq, greatest(n, coalesce(pg_sequence_last_value(seq), 1)), true);
  end if;
  return new;
end $$;
create trigger assignments_sync_code after insert on public.assignments
  for each row execute function public.sync_code_sequence('public.assignment_code_seq');
create trigger submissions_sync_code after insert on public.submissions
  for each row execute function public.sync_code_sequence('public.submission_code_seq');

-- Grade history and audit logs are append-only, even for privileged roles using the API.
create or replace function public.prevent_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '42501';
end $$;
create trigger grade_history_append_only before update on public.grade_history
  for each row execute function public.prevent_mutation();
create trigger audit_logs_append_only before update on public.audit_logs
  for each row execute function public.prevent_mutation();
