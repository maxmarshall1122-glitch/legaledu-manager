import Link from "next/link";
import { ClipboardCheck, Trash2 } from "lucide-react";
import { deleteSubmissionAction } from "@/app/actions/work";
import { ConfirmButton } from "@/components/client-ui";
import { FileList } from "@/components/file-list";
import { Badge, Card, CardBody, CardHeader, DescriptionList, LinkButton, PageHeader, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate, formatNumber } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { getSubmissionDetail } from "@/lib/services/submissions";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { FollowUpForm, StatusForm } from "./controls";

export const generateMetadata = titled("nav.submissions");

export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const { id } = await params;
  const d = await orNotFound(getSubmissionDetail(ctx, id));
  const s = d.submission;
  const who = (pid: string | null) => (pid ? d.profiles.get(pid)?.full_name ?? t("common.missing") : t("common.missing"));
  return (
    <>
      <PageHeader
        title={t("submissions.detailTitle", { code: s.code })}
        description={`${d.student?.student_code ?? ""} · ${d.student?.full_name ?? ""} · ${d.assignment.title}`}
        back={{ href: "/submissions", label: t("submissions.title") }}
        actions={
          <>
            <Badge tone={WORK_STATUS_TONE[s.status]}>{t(`workStatus.${s.status}`)}</Badge>
            <LinkButton href={`/grading/${s.id}`} size="sm">
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              {t("submissions.openGrading")}
            </LinkButton>
            <ConfirmButton
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              title={t("submissions.deleteTitle")}
              body={t("submissions.deleteBody")}
              confirmLabel={t("confirm.deleteConfirm")}
              action={deleteSubmissionAction.bind(null, s.id)}
              redirectTo="/submissions"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title={t("common.details")} />
            <CardBody>
              <DescriptionList
                items={[
                  { label: t("submissions.student"), value: d.student ? <Link className="text-primary hover:underline" href={`/students/${d.student.id}`}>{d.student.student_code} — {d.student.full_name}</Link> : t("common.missing") },
                  { label: t("submissions.assignment"), value: <Link className="text-primary hover:underline" href={`/assignments/${d.assignment.id}`}>{d.assignment.code} — {d.assignment.title}</Link> },
                  { label: t("assignments.subject"), value: subjectName(d.subject, L) },
                  { label: t("assignments.deadline"), value: formatDate(d.assignment.deadline, L, true) },
                  { label: t("submissions.submittedAt"), value: <>{formatDate(s.submitted_at, L, true)} {s.is_late && <Badge tone="warning">{t("submissions.late")}</Badge>}</> },
                  { label: t("submissions.currentVersion"), value: `v${s.current_version}` },
                  { label: t("submissions.revisionDeadline"), value: formatDate(s.revision_deadline, L, true) },
                  { label: t("submissions.comment"), value: s.student_comment ?? t("common.missing") },
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("submissions.versions")} />
            <CardBody className="space-y-4">
              {d.filesByVersion.map((v) => (
                <section key={v.version}>
                  <h3 className="mb-2 text-sm font-semibold">
                    {t("common.version")} {v.version} {v.version === s.current_version && <Badge tone="primary">{t("submissions.currentVersion")}</Badge>}
                  </h3>
                  <FileList t={t} locale={L} files={v.files} previewBase="/files" />
                </section>
              ))}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("submissions.reviewHistory")} />
            {d.reviews.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">{t("submissions.noHistory")}</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.version")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th>{t("grading.provisionalScore")}</Th>
                    <Th>{t("grading.finalScore")}</Th>
                    <Th>{t("grading.reviewer")}</Th>
                    <Th>{t("grading.reviewedAt")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.reviews.map((r) => (
                    <tr key={r.id}>
                      <Td>v{r.version}</Td>
                      <Td>
                        <Badge tone={r.status === "approved" ? "success" : r.revision_requested ? "warning" : "neutral"}>
                          {r.status === "approved" ? t("grading.instructorApproved") : r.revision_requested ? t("workStatus.revision_required") : t("grading.draftReview")}
                        </Badge>
                        {r.ai_suggestion_id && (
                          <span className="ml-1">
                            <Badge tone="info">{t("ai.aiAssisted")}</Badge>
                          </span>
                        )}
                      </Td>
                      <Td className="tabular-nums">{formatNumber(r.provisional_score, L, 2)}</Td>
                      <Td className="tabular-nums font-semibold">{formatNumber(r.final_score, L, 2)}</Td>
                      <Td>{who(r.reviewer_id)}</Td>
                      <Td className="whitespace-nowrap">{formatDate(r.reviewed_at, L, true)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
          <Card>
            <CardHeader title={t("submissions.gradeHistory")} />
            {d.history.length === 0 ? (
              <CardBody>
                <p className="text-sm text-muted">{t("submissions.noHistory")}</p>
              </CardBody>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>{t("common.date")}</Th>
                    <Th>{t("common.status")}</Th>
                    <Th>{t("common.from")}</Th>
                    <Th>{t("common.to")}</Th>
                    <Th>{t("common.reason")}</Th>
                    <Th>{t("grading.reviewer")}</Th>
                  </tr>
                </thead>
                <tbody>
                  {d.history.map((h) => (
                    <tr key={h.id}>
                      <Td className="whitespace-nowrap">{formatDate(h.created_at, L, true)}</Td>
                      <Td>{h.kind === "final" ? t("grading.finalScore") : t("grading.provisionalScore")}</Td>
                      <Td className="tabular-nums">{formatNumber(h.old_score, L, 2)}</Td>
                      <Td className="tabular-nums">{formatNumber(h.new_score, L, 2)}</Td>
                      <Td>{h.reason ?? t("common.missing")}</Td>
                      <Td>{who(h.changed_by)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("submissions.status")} />
            <CardBody>
              <StatusForm submissionId={s.id} status={s.status} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("submissions.followUp")} />
            <CardBody>
              <FollowUpForm submissionId={s.id} note={s.follow_up_note} due={s.follow_up_due} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
