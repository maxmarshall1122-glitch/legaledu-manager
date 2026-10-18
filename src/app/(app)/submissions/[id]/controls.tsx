"use client";

import { useState } from "react";
import { setFollowUpAction, setSubmissionStatusAction } from "@/app/actions/work";
import { SubmitButton, useAction } from "@/components/client-ui";
import { useI18n } from "@/components/i18n-provider";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { toLocalInput } from "@/lib/format";
import { SUBMISSION_STATUSES, type SubmissionStatus } from "@/lib/types";

export function FollowUpForm({ submissionId, note, due }: { submissionId: string; note: string | null; due: string | null }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [n, setN] = useState(note ?? "");
  const [d, setD] = useState(toLocalInput(due));
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => setFollowUpAction({ submission_id: submissionId, follow_up_note: n, follow_up_due: d ? new Date(d).toISOString() : "" }));
      }}
    >
      <Field label={t("submissions.followUpNote")} htmlFor="fu-note">
        <Textarea id="fu-note" rows={3} maxLength={1000} value={n} onChange={(e) => setN(e.target.value)} />
      </Field>
      <Field label={t("submissions.followUpDue")} htmlFor="fu-due">
        <Input id="fu-due" type="datetime-local" value={d} onChange={(e) => setD(e.target.value)} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending} variant="secondary">
          {t("common.save")}
        </SubmitButton>
      </div>
    </form>
  );
}

export function StatusForm({ submissionId, status }: { submissionId: string; status: SubmissionStatus }) {
  const { t } = useI18n();
  const { run, pending } = useAction();
  const [s, setS] = useState(status);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void run(() => setSubmissionStatusAction(submissionId, s));
      }}
    >
      <div className="min-w-44 flex-1 space-y-1">
        <label htmlFor="sub-status" className="block text-sm font-medium">
          {t("submissions.setStatus")}
        </label>
        <Select id="sub-status" value={s} onChange={(e) => setS(e.target.value as SubmissionStatus)}>
          {SUBMISSION_STATUSES.map((x) => (
            <option key={x} value={x}>
              {t(`workStatus.${x}`)}
            </option>
          ))}
        </Select>
      </div>
      <SubmitButton pending={pending} variant="outline" disabled={s === status}>
        {t("common.save")}
      </SubmitButton>
    </form>
  );
}
