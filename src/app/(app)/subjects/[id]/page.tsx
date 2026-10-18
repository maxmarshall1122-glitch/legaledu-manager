import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteSubjectAction } from "@/app/actions/records";
import { ConfirmButton } from "@/components/client-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState, LinkButton, PageHeader, StatCard, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate, formatNumber } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { getSubjectDetail } from "@/lib/services/subjects";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { SubjectFormDialog } from "../subject-form";

export const generateMetadata = titled("nav.subjects");

export default async function SubjectPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const { id } = await params;
  const d = await orNotFound(getSubjectDetail(ctx, id));
  const description = L === "uz" ? d.subject.description_uz : d.subject.description_en;
  return (
    <>
      <PageHeader
        title={subjectName(d.subject, L)}
        description={`${d.subject.code} · ${L === "uz" ? d.subject.name_en : d.subject.name_uz}`}
        back={{ href: "/subjects", label: t("subjects.title") }}
        actions={
          <>
            <SubjectFormDialog subject={d.subject} groups={d.allGroups} groupIds={d.groups.map((g) => g.id)} />
            <ConfirmButton
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              title={t("subjects.deleteTitle")}
              body={t("subjects.deleteBody", { name: subjectName(d.subject, L) })}
              confirmLabel={t("confirm.deleteConfirm")}
              action={deleteSubjectAction.bind(null, d.subject.id)}
              redirectTo="/subjects"
              disabled={d.assignmentCount > 0}
            />
          </>
        }
      />
      {description && <p className="-mt-3 mb-6 max-w-3xl text-sm text-foreground">{description}</p>}
      <section aria-label={t("subjects.statistics")} className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label={t("subjects.assignmentsCount")} value={d.assignmentCount} />
        <StatCard label={t("subjects.submissionsCount")} value={d.submissionCount} />
        <StatCard label={t("subjects.gradedCount")} value={d.gradedCount} />
        <StatCard label={t("subjects.averageScore")} value={d.averagePercent === null ? t("common.missing") : `${formatNumber(d.averagePercent, L)}%`} hint={t("dashboard.averageScoreHint")} />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("subjects.relatedAssignments")} actions={<LinkButton href={`/assignments/new?subject=${d.subject.id}`} size="sm">{t("assignments.add")}</LinkButton>} />
          {d.assignments.length === 0 ? (
            <EmptyState title={t("assignments.empty")} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("assignments.code")}</Th>
                  <Th>{t("assignments.titleField")}</Th>
                  <Th>{t("assignments.deadline")}</Th>
                  <Th>{t("common.status")}</Th>
                </tr>
              </thead>
              <tbody>
                {d.assignments.map((a) => (
                  <tr key={a.id}>
                    <Td className="font-mono text-xs">{a.code}</Td>
                    <Td>
                      <Link href={`/assignments/${a.id}`} className="font-medium hover:text-primary">
                        {a.title}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(a.deadline, L)}</Td>
                    <Td>
                      <Badge tone={WORK_STATUS_TONE[a.status]}>{t(`assignmentStatus.${a.status}`)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("subjects.assignedGroups")} />
            <CardBody>
              {d.groups.length === 0 ? (
                <p className="text-sm text-muted">{t("common.none")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {d.groups.map((g) => (
                    <li key={g.id}>
                      <Link href={`/groups/${g.id}`}>
                        <Badge tone="primary">{g.name}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("subjects.materials")} actions={<LinkButton href={`/materials?subject=${d.subject.id}`} size="sm" variant="outline">{t("common.view")}</LinkButton>} />
            <CardBody>
              {d.materials.length === 0 ? (
                <p className="text-sm text-muted">{t("materials.empty")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.materials.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{m.title}</span>
                      <Badge tone={m.visible_to_students ? "success" : "neutral"}>{m.visible_to_students ? t("materials.visible") : t("materials.hidden")}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
