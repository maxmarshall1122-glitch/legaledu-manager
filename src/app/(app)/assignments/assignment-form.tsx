"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { createAssignmentAction, updateAssignmentAction } from "@/app/actions/records";
import { SubmitButton, useAction } from "@/components/client-ui";
import { applyServerErrors, aria } from "@/components/form-utils";
import { useI18n } from "@/components/i18n-provider";
import { Alert, Button, Card, CardBody, CardHeader, Field, Input, Select, Textarea } from "@/components/ui";
import { ASSIGNMENT_TEMPLATES } from "@/i18n/templates";
import { toLocalInput } from "@/lib/format";
import { defaultRubric } from "@/lib/rubric";
import { ASSIGNMENT_TYPES, type Assignment, type Group, type RubricCriterion, type Subject, type TeachingMaterial } from "@/lib/types";
import { assignmentSchema } from "@/lib/validation";

type In = z.input<typeof assignmentSchema>;
type Out = z.output<typeof assignmentSchema>;

export function AssignmentForm({
  subjects,
  groups,
  materials,
  assignment,
  criteria,
  groupIds,
  defaultSubjectId,
}: {
  subjects: Subject[];
  groups: Group[];
  materials: TeachingMaterial[];
  assignment?: Assignment;
  criteria?: RubricCriterion[];
  groupIds?: string[];
  defaultSubjectId?: string;
}) {
  const { t, tm, locale } = useI18n();
  const { run, pending } = useAction();
  const router = useRouter();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      title: assignment?.title ?? "",
      subject_id: assignment?.subject_id ?? defaultSubjectId ?? subjects[0]?.id ?? "",
      group_ids: groupIds ?? [],
      description: assignment?.description ?? "",
      instructions: assignment?.instructions ?? "",
      language: assignment?.language ?? locale,
      assignment_type: assignment?.assignment_type ?? "essay",
      issue_date: toLocalInput(assignment?.issue_date ?? new Date().toISOString()),
      deadline: toLocalInput(assignment?.deadline),
      max_score: assignment?.max_score ?? 100,
      criteria: criteria?.length
        ? criteria.map((c) => ({ id: c.id, title: c.title, description: c.description ?? "", max_points: c.max_points, weight: c.weight }))
        : defaultRubric(assignment?.language ?? locale),
      material_ids: materials.filter((m) => assignment && m.assignment_id === assignment.id).map((m) => m.id),
    },
  });
  const { fields, append, remove, move, replace } = useFieldArray({ control: form.control, name: "criteria" });
  const e = form.formState.errors;
  const err = (msg: unknown) => (msg ? tm(String(msg)) : undefined);
  const [subjectId, language, rubric, maxScore] = useWatch({ control: form.control, name: ["subject_id", "language", "criteria", "max_score"] });
  const rubricSum = (rubric ?? []).reduce((a, c) => a + (Number(c?.max_points) || 0), 0);
  const subjectMaterials = materials.filter((m) => m.subject_id === subjectId);
  const lang = (language === "en" ? "en" : "uz") as "uz" | "en";

  const submit = (status: "draft" | "published") =>
    form.handleSubmit(async (values) => {
      const res = await run(() => (assignment ? updateAssignmentAction(assignment.id, values) : createAssignmentAction(values, status)), {
        onSuccess: (id) => {
          router.push(`/assignments/${id}`);
        },
      });
      if (!res.ok) applyServerErrors(res, form.setError);
    });

  const applyTemplate = (id: string) => {
    const tpl = ASSIGNMENT_TEMPLATES.find((x) => x.id === id);
    if (!tpl) return;
    form.setValue("assignment_type", tpl.type);
    if (!form.getValues("description")) form.setValue("description", tpl.description[lang]);
    form.setValue("instructions", tpl.instructions[lang], { shouldDirty: true });
  };

  return (
    <form onSubmit={submit("draft")} noValidate className="space-y-6">
      {Object.keys(e).length > 0 && <Alert tone="danger">{tm(String(e.root?.message ?? e.criteria?.message ?? "validation.required"))}</Alert>}
      <Card>
        <CardHeader title={t("common.details")} />
        <CardBody className="grid gap-4 md:grid-cols-2">
          <Field label={t("assignments.titleField")} htmlFor="a-title" required error={err(e.title?.message)} className="md:col-span-2">
            <Input {...aria("a-title", err(e.title?.message))} {...form.register("title")} />
          </Field>
          <Field label={t("assignments.subject")} htmlFor="a-subject" required error={err(e.subject_id?.message)}>
            <Select {...aria("a-subject", err(e.subject_id?.message))} {...form.register("subject_id")}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {locale === "uz" ? s.name_uz : s.name_en}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("assignments.type")} htmlFor="a-type" required>
            <Select id="a-type" {...form.register("assignment_type")}>
              {ASSIGNMENT_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`assignmentType.${ty}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("assignments.language")} htmlFor="a-lang" required>
            <Select id="a-lang" {...form.register("language")}>
              <option value="uz">{t("common.uzbek")}</option>
              <option value="en">{t("common.english")}</option>
            </Select>
          </Field>
          <Field label={t("assignments.maxScore")} htmlFor="a-max" required error={err(e.max_score?.message)}>
            <Input {...aria("a-max", err(e.max_score?.message))} type="number" min={1} max={1000} step="any" {...form.register("max_score")} />
          </Field>
          <Field label={t("assignments.issueDate")} htmlFor="a-issue" error={err(e.issue_date?.message)}>
            <Input {...aria("a-issue", err(e.issue_date?.message))} type="datetime-local" {...form.register("issue_date")} />
          </Field>
          <Field label={t("assignments.deadline")} htmlFor="a-deadline" error={err(e.deadline?.message)}>
            <Input {...aria("a-deadline", err(e.deadline?.message))} type="datetime-local" {...form.register("deadline")} />
          </Field>
          <fieldset className="space-y-1.5 md:col-span-2">
            <legend className="text-sm font-medium">{t("assignments.targetGroups")}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border p-2" aria-invalid={e.group_ids ? true : undefined}>
              {groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={g.id} {...form.register("group_ids")} className="h-4 w-4 accent-[var(--primary)]" />
                  {g.name}
                </label>
              ))}
            </div>
            {e.group_ids && (
              <p role="alert" className="text-xs font-medium text-danger">
                {tm(String(e.group_ids.message))}
              </p>
            )}
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("assignments.instructions")}
          actions={
            <div className="flex items-center gap-2">
              <label htmlFor="a-template" className="text-sm text-muted">
                {t("assignments.template")}
              </label>
              <Select id="a-template" className="h-8 w-56" defaultValue="" onChange={(ev) => applyTemplate(ev.target.value)}>
                <option value="">—</option>
                {ASSIGNMENT_TEMPLATES.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.label[locale]}
                  </option>
                ))}
              </Select>
            </div>
          }
        />
        <CardBody className="space-y-4">
          <Field label={t("assignments.description")} htmlFor="a-desc" error={err(e.description?.message)}>
            <Textarea {...aria("a-desc", err(e.description?.message))} lang={lang} rows={3} {...form.register("description")} />
          </Field>
          <Field label={t("assignments.instructions")} htmlFor="a-instr" error={err(e.instructions?.message)}>
            <Textarea {...aria("a-instr", err(e.instructions?.message))} lang={lang} rows={8} {...form.register("instructions")} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={t("assignments.rubric")}
          description={t("assignments.rubricHint")}
          actions={
            <Button variant="ghost" size="sm" onClick={() => replace(defaultRubric(lang))}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {t("assignments.resetRubric")}
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {fields.map((f, i) => {
            const ce = e.criteria?.[i];
            return (
              <div key={f.id} className="grid grid-cols-12 items-start gap-2 rounded-md border border-border p-3">
                <Field label={`${t("assignments.criterion")} ${i + 1}`} htmlFor={`c-${i}-title`} error={err(ce?.title?.message)} className="col-span-12 md:col-span-6">
                  <Input {...aria(`c-${i}-title`, err(ce?.title?.message))} lang={lang} {...form.register(`criteria.${i}.title`)} />
                </Field>
                <Field label={t("assignments.maxPoints")} htmlFor={`c-${i}-max`} error={err(ce?.max_points?.message)} className="col-span-4 md:col-span-2">
                  <Input {...aria(`c-${i}-max`, err(ce?.max_points?.message))} type="number" min={0} step="any" {...form.register(`criteria.${i}.max_points`)} />
                </Field>
                <Field label={t("assignments.weight")} htmlFor={`c-${i}-w`} error={err(ce?.weight?.message)} className="col-span-4 md:col-span-2">
                  <Input {...aria(`c-${i}-w`, err(ce?.weight?.message))} type="number" min={0} step="any" {...form.register(`criteria.${i}.weight`)} />
                </Field>
                <div className="col-span-4 flex items-end justify-end gap-1 pt-6 md:col-span-2">
                  <Button variant="ghost" size="icon" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`↑ ${i + 1}`}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={i === fields.length - 1} onClick={() => move(i, i + 1)} aria-label={`↓ ${i + 1}`}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={fields.length <= 1} onClick={() => remove(i)} aria-label={`${t("common.remove")} ${i + 1}`}>
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={() => append({ title: "", description: "", max_points: 10, weight: 10 })}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t("assignments.addCriterion")}
            </Button>
            <p className="text-sm text-muted" aria-live="polite">
              Σ {t("assignments.maxPoints")}: <span className="font-semibold tabular-nums text-foreground">{rubricSum}</span>
              {Number(maxScore) > 0 && rubricSum !== Number(maxScore) && <span className="ml-2 text-warning">{t("assignments.rubricTotalMismatch", { sum: rubricSum, max: Number(maxScore) })}</span>}
            </p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={t("assignments.attachments")} description={t("assignments.attachmentsHint")} />
        <CardBody>
          {subjectMaterials.length === 0 ? (
            <p className="text-sm text-muted">{t("materials.empty")}</p>
          ) : (
            <div className="space-y-1">
              {subjectMaterials.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" value={m.id} {...form.register("material_ids")} className="h-4 w-4 accent-[var(--primary)]" />
                  {m.title}
                  <span className="text-xs text-muted">({m.visible_to_students ? t("materials.visible") : t("materials.hidden")})</span>
                </label>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-xs text-muted">{t("assignments.noExternalDistribution")}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {assignment ? (
          <SubmitButton pending={pending}>{pending ? t("common.saving") : t("common.save")}</SubmitButton>
        ) : (
          <>
            <SubmitButton pending={pending} variant="outline">
              {t("assignments.saveDraft")}
            </SubmitButton>
            <Button disabled={pending} onClick={submit("published")}>
              <Send className="h-4 w-4" aria-hidden="true" />
              {t("assignments.publish")}
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
