"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, UserPlus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createStudentAction, updateStudentAction } from "@/app/actions/records";
import { Modal, SubmitButton, useAction } from "@/components/client-ui";
import { applyServerErrors, aria } from "@/components/form-utils";
import { useI18n } from "@/components/i18n-provider";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { ENROLLMENT_STATUSES, type Group, type Student } from "@/lib/types";
import { studentSchema, type StudentInput } from "@/lib/validation";

function currentAcademicYear() {
  const d = new Date();
  const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-${y + 1}`;
}

export function StudentFormDialog({
  groups,
  student,
  groupIds = [],
  autoOpen = false,
}: {
  groups: Group[];
  student?: Student;
  groupIds?: string[];
  autoOpen?: boolean;
}) {
  const { t, tm } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(autoOpen);
  const { run, pending } = useAction();
  const form = useForm<StudentInput>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      student_code: student?.student_code ?? "",
      full_name: student?.full_name ?? "",
      email: student?.email ?? "",
      academic_year: student?.academic_year ?? currentAcademicYear(),
      enrollment_status: student?.enrollment_status ?? "active",
      notes: student?.notes ?? "",
      group_ids: groupIds,
    },
  });
  const e = form.formState.errors;
  const err = (k: keyof StudentInput) => (e[k]?.message ? tm(String(e[k]?.message)) : undefined);

  const close = (v: boolean) => {
    setOpen(v);
    if (!v && params.get("new")) router.replace("/students");
  };

  const onSubmit = form.handleSubmit(async (values) => {
    const res = await run(() => (student ? updateStudentAction(student.id, values) : createStudentAction(values)));
    if (res.ok) {
      close(false);
      if (!student) form.reset();
    } else applyServerErrors(res, form.setError);
  });

  return (
    <>
      {student ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("common.edit")}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          {t("students.add")}
        </Button>
      )}
      <Modal open={open} onOpenChange={close} title={student ? t("students.editTitle") : t("students.createTitle")} wide>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label={t("students.studentCode")} htmlFor="student_code" required error={err("student_code")} hint={t("students.studentCodeHint")}>
            <Input {...aria("student_code", err("student_code"), true)} autoComplete="off" {...form.register("student_code")} />
          </Field>
          <Field label={t("students.fullName")} htmlFor="full_name" required error={err("full_name")}>
            <Input {...aria("full_name", err("full_name"))} autoComplete="off" {...form.register("full_name")} />
          </Field>
          <Field label={t("students.email")} htmlFor="email" error={err("email")}>
            <Input {...aria("email", err("email"))} type="email" autoComplete="off" {...form.register("email")} />
          </Field>
          <Field label={t("students.academicYear")} htmlFor="academic_year" required error={err("academic_year")} hint={t("students.academicYearHint")}>
            <Input {...aria("academic_year", err("academic_year"), true)} inputMode="numeric" {...form.register("academic_year")} />
          </Field>
          <Field label={t("students.enrollmentStatus")} htmlFor="enrollment_status" required error={err("enrollment_status")}>
            <Select {...aria("enrollment_status", err("enrollment_status"))} {...form.register("enrollment_status")}>
              {ENROLLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`enrollment.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-foreground">{t("students.group")}</legend>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {groups.length === 0 && <p className="text-xs text-muted">{t("groups.empty")}</p>}
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={g.id} {...form.register("group_ids")} className="h-4 w-4 accent-[var(--primary)]" />
                  {g.name} <span className="text-xs text-muted">({g.academic_year})</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Field label={t("students.notes")} htmlFor="notes" error={err("notes")} hint={t("students.notesHint")} className="sm:col-span-2">
            <Textarea {...aria("notes", err("notes"), true)} rows={3} {...form.register("notes")} />
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button variant="outline" onClick={() => close(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton pending={pending}>{pending ? t("common.saving") : t("common.save")}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
