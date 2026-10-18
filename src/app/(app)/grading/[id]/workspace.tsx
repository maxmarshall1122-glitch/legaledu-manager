"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { Bot, CheckCircle2, Loader2, RotateCcw, Save, Sparkles, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  approveGradeAction,
  changeFinalGradeAction,
  markCompletedAction,
  rejectAiSuggestionAction,
  requestAiReviewAction,
  requestRevisionAction,
  saveReviewDraftAction,
} from "@/app/actions/work";
import { SubmitButton, useAction } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";
import { Alert, Badge, Button, buttonClass, Card, CardBody, CardHeader, Field, Input, Select, Textarea, WORK_STATUS_TONE } from "@/components/ui";
import { FEEDBACK_TEMPLATES } from "@/i18n/templates";
import { toLocalInput } from "@/lib/format";
import { computeTotal } from "@/lib/rubric";
import type { AiProviderId, AiSuggestion, Feedback, Locale, Review, RubricCriterion, RubricScore } from "@/lib/types";
import type { ReviewInput } from "@/lib/validation";

interface FormValues {
  scores: { criterion_id: string; score: string; comment: string }[];
  strengths: string;
  improvements: string;
  student_feedback: string;
  final_override: string;
  override_reason: string;
  revision_deadline: string;
}

function ConfirmDialog({ open, onOpenChange, title, body, onConfirm, pending, confirmLabel }: { open: boolean; onOpenChange: (v: boolean) => void; title: string; body: string; onConfirm: () => void; pending: boolean; confirmLabel: string }) {
  const { t } = useI18n();
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-6 shadow-xl">
          <AlertDialog.Title className="text-lg font-semibold">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted">{body}</AlertDialog.Description>
          <div className="mt-6 flex justify-end gap-2">
            <AlertDialog.Cancel className={buttonClass("outline")}>{t("common.cancel")}</AlertDialog.Cancel>
            <Button onClick={onConfirm} disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function GradingWorkspace({
  submissionId,
  status,
  language,
  maxScore,
  criteria,
  review,
  scores,
  feedback,
  suggestions,
  providers,
  defaultRevisionDeadline,
}: {
  defaultRevisionDeadline: string;
  submissionId: string;
  status: string;
  language: Locale;
  maxScore: number;
  criteria: RubricCriterion[];
  review: Review | null;
  scores: RubricScore[];
  feedback: Feedback | null;
  suggestions: AiSuggestion[];
  providers: Record<AiProviderId, { configured: boolean; model: string }>;
}) {
  const { t, tm, locale } = useI18n();
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState<null | "approve" | "revision">(null);
  const [aiSuggestionId, setAiSuggestionId] = useState<string | null>(review?.ai_suggestion_id ?? null);
  const approved = review?.status === "approved";

  const form = useForm<FormValues>({
    defaultValues: {
      scores: criteria.map((c) => {
        const s = scores.find((x) => x.criterion_id === c.id);
        return { criterion_id: c.id, score: s ? String(s.score) : "", comment: s?.comment ?? "" };
      }),
      strengths: feedback?.strengths ?? "",
      improvements: feedback?.improvements ?? "",
      student_feedback: feedback?.student_feedback ?? "",
      final_override: "",
      override_reason: "",
      revision_deadline: toLocalInput(review?.revision_deadline ?? defaultRevisionDeadline),
    },
  });
  const watched = useWatch({ control: form.control, name: "scores" });
  const live = useMemo(() => {
    const map: Record<string, number | null> = {};
    watched?.forEach((s) => (map[s.criterion_id] = s.score === "" ? null : Number(s.score)));
    return computeTotal(criteria, map, maxScore);
  }, [watched, criteria, maxScore]);
  const issueFor = (cid: string) => live.issues.find((i) => i.criterion_id === cid && i.message !== "validation.required");

  const payload = (): ReviewInput => {
    const v = form.getValues();
    return {
      submission_id: submissionId,
      scores: v.scores.map((s) => ({ criterion_id: s.criterion_id, score: s.score === "" ? null : Number(s.score), comment: s.comment })),
      strengths: v.strengths,
      improvements: v.improvements,
      student_feedback: v.student_feedback,
      ai_suggestion_id: aiSuggestionId,
      final_override: v.final_override === "" ? "" : Number(v.final_override),
      override_reason: v.override_reason,
      revision_deadline: v.revision_deadline ? new Date(v.revision_deadline).toISOString() : "",
    };
  };
  const showFieldErrors = (res: { ok: boolean; fieldErrors?: Record<string, string> }) => {
    if (res.ok || !res.fieldErrors) return;
    for (const [k, msg] of Object.entries(res.fieldErrors)) form.setError(k as keyof FormValues, { message: msg });
  };

  const insert = (field: "strengths" | "improvements" | "student_feedback", text: string) => {
    const cur = form.getValues(field);
    form.setValue(field, cur ? `${cur}\n${text}` : text, { shouldDirty: true });
  };

  const applySuggestion = (s: AiSuggestion) => {
    if (!s.parsed) return;
    form.setValue(
      "scores",
      criteria.map((c) => {
        const x = s.parsed!.criteria.find((y) => y.criterion_id === c.id);
        return { criterion_id: c.id, score: x ? String(x.suggested_score) : "", comment: x?.comment ?? "" };
      }),
    );
    form.setValue("strengths", s.parsed.strengths);
    form.setValue("improvements", s.parsed.improvements);
    form.setValue("student_feedback", s.parsed.student_feedback);
    setAiSuggestionId(s.id);
    toast.info(t("ai.applied"));
  };

  const override = useWatch({ control: form.control, name: "final_override" });
  const finalPreview = override !== "" ? Number(override) : live.total;
  const anyProvider = providers.anthropic.configured || providers.gemini.configured;

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="space-y-6 xl:col-span-3">
        {approved ? (
          <ApprovedPanel review={review!} submissionId={submissionId} maxScore={maxScore} status={status} />
        ) : (
          <form onSubmit={(e) => e.preventDefault()} noValidate className="space-y-6">
            <Card>
              <CardHeader
                title={t("grading.rubricScores")}
                description={review ? t("grading.draftReview") : undefined}
                actions={aiSuggestionId ? <Badge tone="info">{t("ai.aiAssisted")}</Badge> : undefined}
              />
              <CardBody className="space-y-4">
                {criteria.length === 0 && <Alert tone="warning">{t("grading.noRubric")}</Alert>}
                {criteria.map((c, i) => {
                  const issue = issueFor(c.id);
                  const err = form.formState.errors.scores?.[i]?.score?.message ?? issue?.message;
                  return (
                    <div key={c.id} className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-[1fr_8rem]">
                      <div className="min-w-0">
                        <p className="font-medium" lang={language}>
                          {c.title}
                        </p>
                        <p className="text-xs text-muted">
                          {t("assignments.maxPoints")}: {c.max_points} · {t("assignments.weight")}: {c.weight}
                        </p>
                      </div>
                      <Field label={t("grading.score")} htmlFor={`score-${i}`} error={err ? tm(err) : undefined}>
                        <Input
                          id={`score-${i}`}
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={c.max_points}
                          step="0.5"
                          aria-invalid={err ? true : undefined}
                          aria-describedby={err ? `score-${i}-error` : undefined}
                          {...form.register(`scores.${i}.score`)}
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <label htmlFor={`comment-${i}`} className="sr-only">
                          {t("grading.criterionComment")}
                        </label>
                        <Textarea id={`comment-${i}`} rows={2} placeholder={t("grading.criterionComment")} lang={language} {...form.register(`scores.${i}.comment`)} />
                      </div>
                    </div>
                  );
                })}
                <div className="flex items-center justify-between rounded-md bg-primary-soft px-4 py-3" aria-live="polite">
                  <span className="text-sm font-medium text-primary">{t("grading.calculatedTotal")}</span>
                  <span className="text-xl font-semibold tabular-nums text-primary">
                    {live.total === null ? t("common.missing") : live.total} / {maxScore}
                  </span>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t("portal.feedback")} />
              <CardBody className="space-y-4">
                {(["strengths", "improvements", "student_feedback"] as const).map((field) => (
                  <Field
                    key={field}
                    label={t(field === "strengths" ? "grading.strengths" : field === "improvements" ? "grading.improvements" : "grading.studentFeedback")}
                    htmlFor={`fb-${field}`}
                    hint={field === "student_feedback" ? t("grading.studentFeedbackHint") : undefined}
                  >
                    <Textarea id={`fb-${field}`} rows={field === "student_feedback" ? 5 : 3} lang={language} {...form.register(field)} />
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-xs text-muted">{t("grading.insertTemplate")}:</span>
                      {FEEDBACK_TEMPLATES.filter((f) => f.field === field).map((tpl) => (
                        <button key={tpl.id} type="button" onClick={() => insert(field, tpl.text[language])} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary">
                          {tpl.text[language].slice(0, 32)}…
                        </button>
                      ))}
                    </div>
                  </Field>
                ))}
              </CardBody>
            </Card>

            <Card>
              <CardHeader title={t("common.actions")} />
              <CardBody className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("grading.overrideFinal")} htmlFor="override" hint={t("grading.overrideHint")} error={form.formState.errors.final_override?.message ? tm(form.formState.errors.final_override.message) : undefined}>
                    <Input id="override" type="number" min={0} max={maxScore} step="0.5" {...form.register("final_override")} />
                  </Field>
                  <Field label={t("common.reason")} htmlFor="override-reason" error={form.formState.errors.override_reason?.message ? tm(form.formState.errors.override_reason.message) : undefined}>
                    <Input id="override-reason" maxLength={1000} {...form.register("override_reason")} />
                  </Field>
                  <Field label={t("grading.revisionDeadline")} htmlFor="rev-deadline" error={form.formState.errors.revision_deadline?.message ? tm(form.formState.errors.revision_deadline.message) : undefined}>
                    <Input id="rev-deadline" type="datetime-local" {...form.register("revision_deadline")} />
                  </Field>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="outline" disabled={pending} onClick={async () => showFieldErrors(await run(() => saveReviewDraftAction(payload())))}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    {t("grading.saveDraft")}
                  </Button>
                  <Button variant="secondary" disabled={pending} onClick={() => setConfirm("revision")}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {t("grading.requestRevision")}
                  </Button>
                  <Button disabled={pending || live.total === null} onClick={() => setConfirm("approve")}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    {t("grading.approve")}
                  </Button>
                </div>
              </CardBody>
            </Card>
            <ConfirmDialog
              open={confirm === "approve"}
              onOpenChange={(v) => !v && setConfirm(null)}
              title={t("grading.approveConfirmTitle")}
              body={t("grading.approveConfirmBody", { score: `${finalPreview ?? "—"} / ${maxScore}` })}
              confirmLabel={t("grading.approve")}
              pending={pending}
              onConfirm={async () => {
                const res = await run(() => approveGradeAction(payload()));
                setConfirm(null);
                showFieldErrors(res);
              }}
            />
            <ConfirmDialog
              open={confirm === "revision"}
              onOpenChange={(v) => !v && setConfirm(null)}
              title={t("grading.revisionConfirmTitle")}
              body={t("grading.revisionConfirmBody")}
              confirmLabel={t("grading.requestRevision")}
              pending={pending}
              onConfirm={async () => {
                const res = await run(() => requestRevisionAction(payload()));
                setConfirm(null);
                showFieldErrors(res);
              }}
            />
          </form>
        )}
      </div>

      <div className="space-y-6 xl:col-span-2">
        <AiPanel
          submissionId={submissionId}
          providers={providers}
          anyProvider={anyProvider}
          suggestions={suggestions}
          criteria={criteria}
          canApply={!approved}
          onApply={applySuggestion}
          locale={locale}
        />
      </div>
    </div>
  );
}

function ApprovedPanel({ review, submissionId, maxScore, status }: { review: Review; submissionId: string; maxScore: number; status: string }) {
  const { t, tm } = useI18n();
  const { run, pending } = useAction();
  const [score, setScore] = useState(String(review.final_score ?? ""));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader title={t("grading.instructorApproved")} actions={<Badge tone={WORK_STATUS_TONE[status]}>{t(`workStatus.${status as "graded"}`)}</Badge>} />
      <CardBody className="space-y-5">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums">{review.final_score}</span>
          <span className="text-muted">/ {maxScore}</span>
          {review.provisional_score !== null && review.provisional_score !== review.final_score && (
            <span className="text-sm text-muted">
              ({t("grading.calculatedTotal")}: {review.provisional_score})
            </span>
          )}
        </div>
        <Alert tone="info">{t("grading.alreadyApproved")}</Alert>
        <form
          className="grid gap-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const res = await run(() => changeFinalGradeAction({ submission_id: submissionId, new_score: score, reason }));
            if (!res.ok) setError(tm(Object.values(res.fieldErrors ?? {})[0] ?? res.error));
            else setReason("");
          }}
        >
          <Field label={t("grading.finalScore")} htmlFor="new-score">
            <Input id="new-score" type="number" min={0} max={maxScore} step="0.5" value={score} onChange={(e) => setScore(e.target.value)} />
          </Field>
          <Field label={t("grading.changeReason")} htmlFor="change-reason" hint={t("grading.changeReasonHint")}>
            <Input id="change-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required />
          </Field>
          <SubmitButton pending={pending} variant="outline">
            {t("grading.changeFinal")}
          </SubmitButton>
          {error && (
            <p role="alert" className="text-sm text-danger sm:col-span-3">
              {error}
            </p>
          )}
        </form>
        {status === "graded" && (
          <div className="flex justify-end border-t border-border pt-4">
            <Button variant="secondary" disabled={pending} onClick={() => run(() => markCompletedAction(submissionId))}>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t("grading.markCompleted")}
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function AiPanel({
  submissionId,
  providers,
  anyProvider,
  suggestions,
  criteria,
  canApply,
  onApply,
  locale,
}: {
  submissionId: string;
  providers: Record<AiProviderId, { configured: boolean; model: string }>;
  anyProvider: boolean;
  suggestions: AiSuggestion[];
  criteria: RubricCriterion[];
  canApply: boolean;
  onApply: (s: AiSuggestion) => void;
  locale: Locale;
}) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [provider, setProvider] = useState<AiProviderId>(providers.anthropic.configured ? "anthropic" : "gemini");
  const label = (p: AiProviderId) => (p === "anthropic" ? "Anthropic Claude" : "Google Gemini");
  return (
    <Card className="border-info/40">
      <CardHeader title={t("ai.title")} actions={<Bot className="h-5 w-5 text-info" aria-hidden="true" />} />
      <CardBody className="space-y-4">
        <Alert tone="info">{t("ai.disclaimer")}</Alert>
        {!anyProvider ? (
          <Alert tone="warning">{t("ai.noProviders")}</Alert>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-44 flex-1 space-y-1">
              <label htmlFor="ai-provider" className="block text-sm font-medium">
                {t("ai.provider")}
              </label>
              <Select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)}>
                {(["anthropic", "gemini"] as const).map((p) => (
                  <option key={p} value={p} disabled={!providers[p].configured}>
                    {label(p)} — {providers[p].configured ? providers[p].model : t("ai.notConfigured")}
                  </option>
                ))}
              </Select>
            </div>
            <Button disabled={pending || !providers[provider].configured || criteria.length === 0} onClick={() => run(() => requestAiReviewAction(submissionId, provider))}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
              {t("ai.run")}
            </Button>
          </div>
        )}
        {pending && (
          <p className="text-sm text-muted" role="status">
            {t("ai.running")}
          </p>
        )}
        {suggestions.length > 0 && (
          <div className="space-y-4">
            {suggestions.map((s, idx) => (
              <section key={s.id} className="rounded-md border border-dashed border-info/50 p-3" aria-label={t("ai.suggestion")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {idx === 0 ? t("ai.suggestion") : t("ai.history")} · {label(s.provider)}
                  </p>
                  <Badge tone={WORK_STATUS_TONE[s.status]}>{t(`ai.statusLabel.${s.status}`)}</Badge>
                </div>
                <p className="text-xs text-muted">
                  {s.model} · v{s.version} · {new Date(s.created_at).toLocaleString(locale === "uz" ? "uz-Latn-UZ" : "en-GB")}
                </p>
                {s.parsed && (
                  <>
                    <p className="mt-2 text-sm">
                      {t("grading.provisionalScore")}: <span className="font-semibold tabular-nums">{s.parsed.provisional_total}</span>
                    </p>
                    {s.parsed.truncated_at && <p className="mt-1 text-xs text-warning">{t("ai.truncatedNote", { n: s.parsed.truncated_at })}</p>}
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-primary">{t("common.details")}</summary>
                      <ul className="mt-2 space-y-2">
                        {s.parsed.criteria.map((c) => {
                          const crit = criteria.find((x) => x.id === c.criterion_id);
                          return (
                            <li key={c.criterion_id} className="rounded bg-surface-muted p-2">
                              <p className="font-medium">
                                {crit?.title ?? "?"}: <span className="tabular-nums">{c.suggested_score}</span> / {crit?.max_points}
                              </p>
                              <p className="mt-1 text-xs">
                                <span className="font-semibold">{t("ai.evidence")}:</span> {c.evidence}
                              </p>
                              <p className="mt-1 text-xs">{c.comment}</p>
                            </li>
                          );
                        })}
                      </ul>
                      {s.parsed.caveats && (
                        <p className="mt-2 text-xs text-muted">
                          <span className="font-semibold">{t("ai.caveats")}:</span> {s.parsed.caveats}
                        </p>
                      )}
                    </details>
                    {s.status === "pending" && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canApply && (
                          <Button size="sm" variant="secondary" onClick={() => onApply(s)}>
                            {t("ai.applyToForm")}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectAiSuggestionAction(s.id))}>
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          {t("ai.reject")}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
