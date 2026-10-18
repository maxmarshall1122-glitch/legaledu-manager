"use client";

import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { createMaterialAction, deleteMaterialAction, setMaterialVisibilityAction } from "@/app/actions/work";
import { ConfirmButton, Modal, SubmitButton, useAction } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";

export function AddMaterialDialog({
  subjects,
  assignments,
  defaultSubjectId,
  maxMb,
}: {
  subjects: { id: string; label: string }[];
  assignments: { id: string; label: string; subject_id: string }[];
  defaultSubjectId?: string;
  maxMb: number;
}) {
  const { t, tm } = useI18n();
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(defaultSubjectId ?? subjects[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const { run, pending } = useAction();
  const ref = useRef<HTMLFormElement>(null);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        {t("materials.add")}
      </Button>
      <Modal open={open} onOpenChange={setOpen} title={t("materials.createTitle")}>
        <form
          ref={ref}
          className="space-y-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const fd = new FormData(e.currentTarget);
            const file = fd.get("file");
            if ((!(file instanceof File) || file.size === 0) && !String(fd.get("external_url") ?? "").trim()) return setError(t("materials.fileOrLink"));
            const res = await run(() => createMaterialAction(fd));
            if (res.ok) {
              ref.current?.reset();
              setOpen(false);
            } else setError(tm(Object.values(res.fieldErrors ?? {})[0] ?? res.error));
          }}
        >
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label={t("materials.titleField")} htmlFor="m-title" required>
            <Input id="m-title" name="title" required maxLength={200} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("materials.subject")} htmlFor="m-subject" required>
              <Select id="m-subject" name="subject_id" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("materials.assignment")} htmlFor="m-assignment">
              <Select id="m-assignment" name="assignment_id" defaultValue="">
                <option value="">{t("materials.noAssignment")}</option>
                {assignments
                  .filter((a) => a.subject_id === subjectId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>
          <Field label={t("common.description")} htmlFor="m-desc">
            <Textarea id="m-desc" name="description" rows={2} maxLength={2000} />
          </Field>
          <Field label={t("materials.file")} htmlFor="m-file" hint={t("submissions.uploadHint", { size: maxMb, count: 1 })}>
            <input id="m-file" name="file" type="file" accept=".pdf,.docx,.pptx,.txt" className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary" />
          </Field>
          <Field label={t("materials.externalUrl")} htmlFor="m-url">
            <Input id="m-url" name="external_url" type="url" placeholder="https://" maxLength={2000} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="visible_to_students" className="h-4 w-4 accent-[var(--primary)]" />
            {t("materials.visibleToStudents")}
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <SubmitButton pending={pending}>{t("common.save")}</SubmitButton>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function MaterialRowActions({ id, title, visible }: { id: string; title: string; visible: boolean }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  return (
    <div className="flex justify-end gap-1">
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => setMaterialVisibilityAction(id, !visible))} aria-label={`${visible ? t("materials.hidden") : t("materials.visible")}: ${title}`}>
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        <span className="hidden md:inline">{visible ? t("materials.hidden") : t("materials.visible")}</span>
      </Button>
      <ConfirmButton
        variant="ghost"
        label=""
        ariaLabel={`${t("common.delete")}: ${title}`}
        icon={<Trash2 className="h-4 w-4 text-danger" aria-hidden="true" />}
        title={t("materials.deleteTitle")}
        body={t("materials.deleteBody", { name: title })}
        confirmLabel={t("confirm.deleteConfirm")}
        action={() => deleteMaterialAction(id)}
      />
    </div>
  );
}
