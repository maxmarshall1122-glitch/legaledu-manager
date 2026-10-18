-- LegalEdu Manager — row-level security
-- Roles: admin / lecturer ("staff") and student. Students can only reach their
-- own records, published assignments for their groups, released feedback and
-- visible materials. Students can never read other students' work or grades.

-- ---------------------------------------------------------------------------
-- Role helper functions (SECURITY DEFINER so policies don't recurse through RLS)
-- ---------------------------------------------------------------------------
create or replace function public.app_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'lecturer') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_grader() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'lecturer') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.current_student_id() returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.students s
  join public.profiles p on p.id = s.profile_id
  where s.profile_id = auth.uid() and p.role = 'student'
$$;

create or replace function public.student_group_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select group_id from public.group_memberships where student_id = public.current_student_id()
$$;

create or replace function public.student_can_see_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.assignments a
    join public.assignment_groups ag on ag.assignment_id = a.id
    where a.id = aid and a.status = 'published'
      and ag.group_id in (select public.student_group_ids())
  )
$$;

create or replace function public.owns_submission(sid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.submissions where id = sid and student_id = public.current_student_id())
$$;

create or replace function public.feedback_released_for_review(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.feedback where review_id = rid and released)
$$;

revoke all on function public.app_role, public.is_staff, public.is_grader, public.current_student_id, public.student_group_ids,
  public.student_can_see_assignment(uuid), public.owns_submission(uuid), public.feedback_released_for_review(uuid) from public;
grant execute on function public.app_role, public.is_staff, public.is_grader, public.current_student_id, public.student_group_ids,
  public.student_can_see_assignment(uuid), public.owns_submission(uuid), public.feedback_released_for_review(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere; anonymous users get nothing.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles','students','groups','group_memberships','subjects','subject_groups','assignments',
    'assignment_groups','rubric_criteria','submissions','submission_files','reviews','rubric_scores','feedback',
    'grade_history','teaching_materials','audit_logs','ai_suggestions']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;
grant usage on sequence public.assignment_code_seq, public.submission_code_seq to authenticated;

-- Grade history and audit logs: no UPDATE/DELETE grants at all (append-only).
revoke update, delete on public.grade_history, public.audit_logs from authenticated;

-- ---------------------------------------------------------------------------
-- Staff: full access to academic records
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['students','groups','group_memberships','subjects','subject_groups','assignments','assignment_groups',
    'rubric_criteria','submissions','submission_files','reviews','rubric_scores','feedback','teaching_materials','ai_suggestions']
  loop
    execute format('create policy staff_all on public.%I for all to authenticated using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

create policy staff_select on public.grade_history for select to authenticated using (public.is_staff());
create policy staff_insert on public.grade_history for insert to authenticated with check (public.is_grader() and changed_by = auth.uid());
create policy staff_select on public.audit_logs for select to authenticated using (public.is_staff());
create policy self_insert on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------
create policy self_or_staff_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());
create policy self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy admin_all on public.profiles for all to authenticated using (public.app_role() = 'admin') with check (public.app_role() = 'admin');

-- Only an admin may change anyone's role (prevents self-promotion via the API).
create or replace function public.protect_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and coalesce(public.app_role(), '') <> 'admin' and auth.uid() is not null then
    raise exception 'only an administrator can change roles' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_protect_role before update on public.profiles for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------------
-- Student read access (own records only)
-- ---------------------------------------------------------------------------
create policy student_own on public.students for select to authenticated using (profile_id = auth.uid());
create policy student_own on public.group_memberships for select to authenticated using (student_id = public.current_student_id());
create policy student_own_groups on public.groups for select to authenticated using (id in (select public.student_group_ids()));

-- Subjects are non-confidential reference data.
create policy authenticated_read on public.subjects for select to authenticated using (true);
create policy authenticated_read on public.subject_groups for select to authenticated using (true);

create policy student_visible on public.assignments for select to authenticated using (public.student_can_see_assignment(id));
create policy student_visible on public.assignment_groups for select to authenticated using (group_id in (select public.student_group_ids()));
create policy student_visible on public.rubric_criteria for select to authenticated using (public.student_can_see_assignment(assignment_id));

create policy student_visible on public.teaching_materials for select to authenticated using (
  visible_to_students and (
    (assignment_id is not null and public.student_can_see_assignment(assignment_id))
    or subject_id in (select sg.subject_id from public.subject_groups sg where sg.group_id in (select public.student_group_ids()))
  )
);

-- ---------------------------------------------------------------------------
-- Submissions: students see and submit only their own work
-- ---------------------------------------------------------------------------
create policy student_own_select on public.submissions for select to authenticated using (student_id = public.current_student_id());
create policy student_own_insert on public.submissions for insert to authenticated with check (
  student_id = public.current_student_id() and public.student_can_see_assignment(assignment_id)
  and status = 'submitted' and current_version = 1
  and revision_deadline is null and follow_up_note is null and follow_up_due is null
);
create policy student_own_update on public.submissions for update to authenticated
  using (student_id = public.current_student_id() and status in ('submitted', 'revision_required'))
  with check (student_id = public.current_student_id() and status in ('submitted', 'resubmitted'));

-- Students may only change the resubmission fields of their own submission.
create or replace function public.guard_student_submission_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() or auth.uid() is null then
    return new;
  end if;
  if new.assignment_id <> old.assignment_id or new.student_id <> old.student_id or new.code <> old.code
     or new.revision_deadline is distinct from old.revision_deadline
     or new.follow_up_note is distinct from old.follow_up_note or new.follow_up_due is distinct from old.follow_up_due
     or new.current_version <> old.current_version + 1 then
    raise exception 'students may only upload a new version' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger submissions_student_guard before update on public.submissions for each row execute function public.guard_student_submission_update();

create policy student_own_select on public.submission_files for select to authenticated using (public.owns_submission(submission_id));
create policy student_own_insert on public.submission_files for insert to authenticated with check (
  public.owns_submission(submission_id) and uploaded_by = auth.uid()
  and storage_key like 'submissions/' || submission_id::text || '/%'
);

-- Released feedback and reviews only (never drafts, AI suggestions, rubric internals or grade history).
create policy student_released on public.feedback for select to authenticated using (released and public.owns_submission(submission_id));
create policy student_released on public.reviews for select to authenticated using (public.owns_submission(submission_id) and public.feedback_released_for_review(id));

-- AI suggestions, rubric_scores and grade_history have no student policies: staff-only by construction.
