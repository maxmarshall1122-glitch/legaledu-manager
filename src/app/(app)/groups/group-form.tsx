"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { addGroupMemberAction, createGroupAction, removeGroupMemberAction, updateGroupAction } from "@/app/actions/records";
import { Modal, SubmitButton, useAction } from "@/components/client-ui";
import { applyServerErrors, aria } from "@/components/form-utils";
import { useI18n } from "@/components/i18n-provider";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import type { Group, Student } from "@/lib/types";
import { groupSchema, type GroupInput } from "@/lib/validation";

export function GroupFormDialog({ group }: { group?: Group }) {
  const { t, tm } = useI18n();
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const form = useForm<GroupInput>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: group?.name ?? "", academic_year: group?.academic_year ?? "", description: group?.description ?? "" },
  });
  const e = form.formState.errors;
  const err = (k: keyof GroupInput) => (e[k]?.message ? tm(String(e[k]?.message)) : undefined);
  const onSubmit = form.handleSubmit(async (values) => {
    const res = await run(() => (group ? updateGroupAction(group.id, values) : createGroupAction(values)));
    if (res.ok) {
      setOpen(false);
      if (!group) form.reset();
    } else applyServerErrors(res, form.setError);
  });
  return (
    <>
      {group ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("common.edit")}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("groups.add")}
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen} title={group ? t("groups.editTitle") : t("groups.createTitle")}>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label={t("groups.name")} htmlFor="g-name" required error={err("name")}>
            <Input {...aria("g-name", err("name"))} {...form.register("name")} />
          </Field>
          <Field label={t("groups.academicYear")} htmlFor="g-year" required error={err("academic_year")} hint={t("students.academicYearHint")}>
            <Input {...aria("g-year", err("academic_year"), true)} {...form.register("academic_year")} />
          </Field>
          <Field label={t("groups.description")} htmlFor="g-desc" error={err("description")}>
            <Textarea {...aria("g-desc", err("description"))} rows={3} {...form.register("description")} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton pending={pending}>{pending ? t("common.saving") : t("common.save")}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function AddMemberForm({ groupId, candidates }: { groupId: string; candidates: Student[] }) {
  const { t } = useI18n();
  const [studentId, setStudentId] = useState("");
  const { run, pending } = useAction();
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!studentId) return;
        const res = await run(() => addGroupMemberAction(groupId, studentId));
        if (res.ok) setStudentId("");
      }}
    >
      <div className="min-w-56 flex-1 space-y-1">
        <label htmlFor="add-member" className="block text-sm font-medium">
          {t("groups.addMember")}
        </label>
        <Select id="add-member" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
          <option value="">{t("groups.selectStudent")}</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.student_code} — {s.full_name}
            </option>
          ))}
        </Select>
      </div>
      <SubmitButton pending={pending} disabled={!studentId} variant="secondary">
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {t("common.add")}
      </SubmitButton>
    </form>
  );
}

export function RemoveMemberButton({ groupId, studentId, name }: { groupId: string; studentId: string; name: string }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeGroupMemberAction(groupId, studentId))} aria-label={`${t("groups.removeMember")}: ${name}`}>
      <UserMinus className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t("groups.removeMember")}</span>
    </Button>
  );
}
