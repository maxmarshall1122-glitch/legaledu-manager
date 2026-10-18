"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { uploadSubmissionAction } from "@/app/actions/work";
import { SubmitButton, useAction } from "./client-ui";
import { useI18n } from "./i18n-provider";
import { Alert, Field, Select, Textarea } from "./ui";

const ACCEPT = ".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

/**
 * Upload form used by staff (choose assignment + student) and by students
 * (fixed assignment, own record). Client-side checks are only a convenience;
 * the server re-validates type, signature, size and permissions.
 */
export function UploadForm({
  assignments,
  studentsByAssignment,
  fixedAssignmentId,
  defaultAssignmentId,
  maxMb,
  maxFiles,
  onDone,
  submitLabel,
}: {
  assignments?: { id: string; label: string }[];
  studentsByAssignment?: Record<string, { id: string; label: string }[]>;
  fixedAssignmentId?: string;
  defaultAssignmentId?: string;
  maxMb: number;
  maxFiles: number;
  onDone?: () => void;
  submitLabel?: string;
}) {
  const { t, tm } = useI18n();
  const { run, pending } = useAction();
  const [assignmentId, setAssignmentId] = useState(fixedAssignmentId ?? defaultAssignmentId ?? assignments?.[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const students = studentsByAssignment?.[assignmentId] ?? [];

  return (
    <form
      ref={formRef}
      className="space-y-4"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        const fd = new FormData(e.currentTarget);
        const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
        if (files.length === 0) return setError(t("validation.fileRequired"));
        if (files.length > maxFiles) return setError(t("validation.tooManyFiles", { n: maxFiles }));
        const tooBig = files.find((f) => f.size > maxMb * 1024 * 1024);
        if (tooBig) return setError(t("validation.fileSize", { name: tooBig.name }));
        const badType = files.find((f) => !/\.(pdf|docx|pptx|txt)$/i.test(f.name));
        if (badType) return setError(t("validation.fileType", { name: badType.name }));
        const res = await run(() => uploadSubmissionAction(fd));
        if (res.ok) {
          formRef.current?.reset();
          onDone?.();
        } else setError(tm(res.error));
      }}
    >
      {error && <Alert tone="danger">{error}</Alert>}
      {fixedAssignmentId ? (
        <input type="hidden" name="assignment_id" value={fixedAssignmentId} />
      ) : (
        <Field label={t("submissions.assignment")} htmlFor="u-assignment" required>
          <Select id="u-assignment" name="assignment_id" value={assignmentId} onChange={(e) => setAssignmentId(e.target.value)}>
            {assignments?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {studentsByAssignment && (
        <Field label={t("submissions.student")} htmlFor="u-student" required>
          <Select id="u-student" name="student_id" required>
            {students.length === 0 && <option value="">{t("common.none")}</option>}
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label={t("submissions.files")} htmlFor="u-files" required hint={t("submissions.uploadHint", { size: maxMb, count: maxFiles })}>
        <input
          id="u-files"
          name="files"
          type="file"
          multiple
          accept={ACCEPT}
          aria-describedby="u-files-hint"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary"
        />
      </Field>
      <Field label={studentsByAssignment ? t("submissions.comment") : t("portal.commentLabel")} htmlFor="u-comment">
        <Textarea id="u-comment" name="comment" rows={3} maxLength={2000} />
      </Field>
      <div className="flex justify-end">
        <SubmitButton pending={pending}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {submitLabel ?? t("common.upload")}
        </SubmitButton>
      </div>
    </form>
  );
}
