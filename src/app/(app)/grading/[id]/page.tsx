import Link from "next/link";
import { FileList } from "@/components/file-list";
import { Badge, Card, CardBody, CardHeader, DescriptionList, PageHeader, WORK_STATUS_TONE } from "@/components/ui";
import { providerStatus } from "@/lib/ai/providers";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { getGradingData } from "@/lib/services/grading";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { GradingWorkspace } from "./workspace";

export const generateMetadata = titled("nav.grading");

/** Request-time default for the resubmission deadline (this page is always rendered dynamically). */
function oneWeekFromNow() {
  return new Date(Date.now() + 7 * 86400_000).toISOString();
}

export default async function GradePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const { id } = await params;
  const d = await orNotFound(getGradingData(ctx, id));
  // Raw provider responses stay on the server; the client receives only the validated suggestion.
  const suggestions = d.suggestions.map((s) => ({ ...s, raw_response: null }));
  return (
    <>
      <PageHeader
        title={t("grading.gradeTitle", { code: d.submission.code })}
        description={`${d.assignment.title} · ${subjectName(d.subject, L)}`}
        back={{ href: "/grading", label: t("grading.title") }}
        actions={<Badge tone={WORK_STATUS_TONE[d.submission.status]}>{t(`workStatus.${d.submission.status}`)}</Badge>}
      />
      <Card className="mb-6">
        <CardHeader title={t("grading.documents")} actions={<Link href={`/submissions/${d.submission.id}`} className="text-sm text-primary hover:underline">{t("submissions.versions")}</Link>} />
        <CardBody className="grid gap-5 lg:grid-cols-2">
          <DescriptionList
            items={[
              { label: t("submissions.student"), value: d.student ? `${d.student.student_code} — ${d.student.full_name}` : t("common.missing") },
              { label: t("submissions.currentVersion"), value: `v${d.submission.current_version}` },
              { label: t("submissions.submittedAt"), value: <>{formatDate(d.submission.submitted_at, L, true)} {d.submission.is_late && <Badge tone="warning">{t("common.late")}</Badge>}</> },
              { label: t("submissions.comment"), value: d.submission.student_comment ?? t("common.missing") },
            ]}
          />
          <FileList t={t} locale={L} files={d.files} previewBase="/files" />
        </CardBody>
      </Card>
      <GradingWorkspace
        submissionId={d.submission.id}
        status={d.submission.status}
        language={d.assignment.language}
        maxScore={d.assignment.max_score}
        criteria={d.criteria}
        review={d.review}
        scores={d.scores}
        feedback={d.feedback}
        suggestions={suggestions}
        providers={providerStatus()}
        defaultRevisionDeadline={oneWeekFromNow()}
      />
    </>
  );
}
