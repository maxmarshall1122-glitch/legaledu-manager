import { AssignmentView } from "@/components/assignment-view";
import { FileList } from "@/components/file-list";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, WORK_STATUS_TONE } from "@/components/ui";
import { UploadForm } from "@/components/upload-form";
import { requirePageCtx } from "@/lib/auth/server";
import { uploadLimits } from "@/lib/config";
import { formatDate, formatNumber } from "@/lib/format";
import { getAssignmentForStudent } from "@/lib/services/assignments";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";

export const generateMetadata = titled("portal.title");

export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["student"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const { id } = await params;
  const d = await orNotFound(getAssignmentForStudent(ctx, id));
  const s = d.submission;
  const canSubmit = d.assignment.status === "published" && (!s || s.status === "submitted" || s.status === "revision_required");
  const late = !s && d.assignment.deadline && d.assignment.deadline < new Date().toISOString();
  const limits = uploadLimits();
  const versions = [...new Set(d.files.map((f) => f.version))].sort((a, b) => b - a);
  return (
    <>
      <PageHeader title={d.assignment.title} back={{ href: "/my", label: t("portal.title") }} actions={<Badge tone={WORK_STATUS_TONE[d.status]}>{t(`workStatus.${d.status}`)}</Badge>} />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardBody>
            <AssignmentView t={t} locale={L} assignment={d.assignment} subject={d.subject} criteria={d.criteria} materials={d.materials} />
          </CardBody>
        </Card>
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={s?.status === "revision_required" ? t("portal.resubmitWork") : t("portal.submitWork")} />
            <CardBody className="space-y-3">
              {s?.status === "revision_required" && s.revision_deadline && <Alert tone="warning">{t("portal.revisionRequested", { date: formatDate(s.revision_deadline, L, true) })}</Alert>}
              {canSubmit ? (
                <>
                  {late && <Alert tone="warning">{t("portal.lateWarning")}</Alert>}
                  <UploadForm fixedAssignmentId={d.assignment.id} maxMb={Math.round(limits.maxFileBytes / 1024 / 1024)} maxFiles={limits.maxFilesPerSubmission} submitLabel={t("common.upload")} />
                </>
              ) : (
                <p className="text-sm text-muted">{t("portal.submissionClosed")}</p>
              )}
            </CardBody>
          </Card>
          {s && (
            <Card>
              <CardHeader title={t("portal.yourSubmission")} description={`${s.code} · ${t("submissions.submittedAt")}: ${formatDate(s.submitted_at, L, true)}`} />
              <CardBody className="space-y-4">
                {versions.map((v) => (
                  <section key={v}>
                    <h3 className="mb-2 text-sm font-semibold">
                      {t("common.version")} {v}
                    </h3>
                    <FileList t={t} locale={L} files={d.files.filter((f) => f.version === v)} previewBase="/files" />
                  </section>
                ))}
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={t("portal.feedback")} />
            <CardBody className="space-y-4">
              {d.released.length === 0 ? (
                <p className="text-sm text-muted">{t("portal.noFeedback")}</p>
              ) : (
                d.released.map((r) => (
                  <section key={r.version} className="space-y-2 rounded-md border border-border p-3" lang={d.assignment.language}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {t("common.version")} {r.version}
                      </span>
                      {r.final_score !== null ? (
                        <span className="text-sm">
                          {t("portal.finalScore")}: <span className="font-semibold tabular-nums">{formatNumber(r.final_score, L, 2)}</span> / {d.assignment.max_score}
                        </span>
                      ) : (
                        r.revision_requested && <Badge tone="warning">{t("workStatus.revision_required")}</Badge>
                      )}
                    </div>
                    {r.student_feedback && <p className="whitespace-pre-line text-sm">{r.student_feedback}</p>}
                    {r.strengths && (
                      <p className="whitespace-pre-line text-sm">
                        <span className="font-medium">{t("grading.strengths")}:</span> {r.strengths}
                      </p>
                    )}
                    {r.improvements && (
                      <p className="whitespace-pre-line text-sm">
                        <span className="font-medium">{t("grading.improvements")}:</span> {r.improvements}
                      </p>
                    )}
                  </section>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
