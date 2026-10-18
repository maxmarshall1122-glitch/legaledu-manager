"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { createSubjectAction, updateSubjectAction } from "@/app/actions/records";
import { Modal, SubmitButton, useAction } from "@/components/client-ui";
import { applyServerErrors, aria } from "@/components/form-utils";
import { useI18n } from "@/components/i18n-provider";
import { Button, Field, Input, Textarea } from "@/components/ui";
import type { Group, Subject } from "@/lib/types";
import { subjectSchema, type SubjectInput } from "@/lib/validation";

export function SubjectFormDialog({ subject, groups, groupIds = [] }: { subject?: Subject; groups: Group[]; groupIds?: string[] }) {
  const { t, tm } = useI18n();
  const [open, setOpen] = useState(false);
  const { run, pending } = useAction();
  const form = useForm<SubjectInput>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      code: subject?.code ?? "",
      name_uz: subject?.name_uz ?? "",
      name_en: subject?.name_en ?? "",
      description_uz: subject?.description_uz ?? "",
      description_en: subject?.description_en ?? "",
      group_ids: groupIds,
    },
  });
  const e = form.formState.errors;
  const err = (k: keyof SubjectInput) => (e[k]?.message ? tm(String(e[k]?.message)) : undefined);
  const onSubmit = form.handleSubmit(async (values) => {
    const res = await run(() => (subject ? updateSubjectAction(subject.id, values) : createSubjectAction(values)));
    if (res.ok) {
      setOpen(false);
      if (!subject) form.reset();
    } else applyServerErrors(res, form.setError);
  });
  return (
    <>
      {subject ? (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          {t("common.edit")}
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("subjects.add")}
        </Button>
      )}
      <Modal open={open} onOpenChange={setOpen} title={subject ? t("subjects.editTitle") : t("subjects.createTitle")} wide>
        <form onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
          <Field label={t("subjects.code")} htmlFor="s-code" required error={err("code")} className="sm:col-span-2">
            <Input {...aria("s-code", err("code"))} {...form.register("code")} className="max-w-xs" />
          </Field>
          <Field label={t("subjects.nameUz")} htmlFor="s-nuz" required error={err("name_uz")}>
            <Input {...aria("s-nuz", err("name_uz"))} lang="uz" {...form.register("name_uz")} />
          </Field>
          <Field label={t("subjects.nameEn")} htmlFor="s-nen" required error={err("name_en")}>
            <Input {...aria("s-nen", err("name_en"))} lang="en" {...form.register("name_en")} />
          </Field>
          <Field label={t("subjects.descriptionUz")} htmlFor="s-duz" error={err("description_uz")}>
            <Textarea {...aria("s-duz", err("description_uz"))} lang="uz" rows={3} {...form.register("description_uz")} />
          </Field>
          <Field label={t("subjects.descriptionEn")} htmlFor="s-den" error={err("description_en")}>
            <Textarea {...aria("s-den", err("description_en"))} lang="en" rows={3} {...form.register("description_en")} />
          </Field>
          <fieldset className="space-y-1.5 sm:col-span-2">
            <legend className="text-sm font-medium">{t("subjects.assignedGroups")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border p-2">
              {groups.length === 0 && <p className="text-xs text-muted">{t("groups.empty")}</p>}
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={g.id} {...form.register("group_ids")} className="h-4 w-4 accent-[var(--primary)]" />
                  {g.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end gap-2 sm:col-span-2">
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
