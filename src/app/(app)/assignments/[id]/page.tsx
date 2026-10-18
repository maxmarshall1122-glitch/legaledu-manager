import Link from "next/link";
import { Pencil, Upload } from "lucide-react";
import { AssignmentView } from "@/components/assignment-view";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate } from "@/lib/format";
import { getAssignmentDetail } from "@/lib/services/assignments";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { AssignmentStatusActions } from "./status-actions";

export const generateMetadata = titled("nav.assignments");

export default async function AssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const { id } = await params;
  const d = await orNotFound(getAssignmentDetail(ctx, id));
  const a = d.assignment;
  const submitted = d.matrix.filter((m) => m.submission).length;
  return (
    <>
      <PageHeader
        title={a.title}
        description={`${a.code} · ${d.groups.map((g) => g.name).join(", ") || t("common.none")}`}
        back={{ href: "/assignments", label: t("assignments.title") }}
        actions={
          <>
            <Badge tone={WORK_STATUS_TONE[a.status]}>{t(`assignmentStatus.${a.status}`)}</Badge>
            <LinkButton href={`/assignments/${a.id}/edit`} variant="outline" size="sm">
              <Pencil className="h-4 w-4" aria-hidden="true" />
              {t("common.edit")}
            </LinkButton>
            <AssignmentStatusActions assignment={a} />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title={`${t("assignments.workMatrix")} · ${t("assignments.submissionsSummary", { submitted, expected: d.matrix.length })}`}
            actions={
              a.status !== "archived" && (
                <LinkButton href={`/submissions?upload=1&assignment=${a.id}`} size="sm" variant="secondary">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  {t("submissions.upload")}
                </LinkButton>
              )
            }
          />
          {d.matrix.length === 0 ? (
            <EmptyState title={t("assignments.publishRequiresGroups")} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("students.studentCode")}</Th>
                  <Th>{t("students.fullName")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th>{t("submissions.submittedAt")}</Th>
                  <Th className="text-right">{t("common.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {d.matrix.map(({ student, submission, status }) => (
                  <tr key={student.id}>
                    <Td className="font-mono text-xs">{student.student_code}</Td>
                    <Td>{student.full_name}</Td>
                    <Td>
                      <Badge tone={WORK_STATUS_TONE[status]}>{t(`workStatus.${status}`)}</Badge>
                      {submission?.is_late && (
                        <span className="ml-1">
                          <Badge tone="warning">{t("common.late")}</Badge>
                        </span>
                      )}
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(submission?.submitted_at, L, true)}</Td>
                    <Td className="text-right">
                      {submission && (
                        <Link href={`/grading/${submission.id}`} className="text-sm font-medium text-primary hover:underline">
                          {t("submissions.openGrading")}
                        </Link>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t("assignments.studentView")} description={t("assignments.studentViewHint")} />
          <CardBody>
            <AssignmentView t={t} locale={L} assignment={a} subject={d.subject} criteria={d.criteria} materials={d.materials.filter((m) => m.visible_to_students)} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
