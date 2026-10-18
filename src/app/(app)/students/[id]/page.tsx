import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ConfirmButton } from "@/components/client-ui";
import { Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState, PageHeader, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { deleteStudentAction } from "@/app/actions/records";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate, formatNumber } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { listGroups } from "@/lib/services/groups";
import { getStudentDetail } from "@/lib/services/students";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { StudentFormDialog } from "../student-form";

export const generateMetadata = titled("students.profileTitle");

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const { id } = await params;
  const [{ student, groups, progress }, allGroups] = await Promise.all([orNotFound(getStudentDetail(ctx, id)), listGroups(ctx)]);
  const del = deleteStudentAction.bind(null, student.id);

  return (
    <>
      <PageHeader
        title={student.full_name}
        description={`${t("students.studentCode")}: ${student.student_code}`}
        back={{ href: "/students", label: t("students.title") }}
        actions={
          <>
            <StudentFormDialog groups={allGroups} student={student} groupIds={groups.map((g) => g.id)} />
            <ConfirmButton
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              title={t("students.deleteTitle")}
              body={t("students.deleteBody", { name: student.full_name })}
              confirmLabel={t("confirm.deleteConfirm")}
              action={del}
              redirectTo="/students"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title={t("students.profileTitle")} />
          <CardBody>
            <DescriptionList
              items={[
                { label: t("students.studentCode"), value: <span className="font-mono">{student.student_code}</span> },
                { label: t("students.group"), value: groups.length ? groups.map((g) => g.name).join(", ") : t("students.noGroup") },
                { label: t("students.email"), value: student.email ?? t("common.missing") },
                { label: t("students.academicYear"), value: student.academic_year },
                { label: t("students.enrollmentStatus"), value: t(`enrollment.${student.enrollment_status}`) },
                { label: t("students.linkedAccount"), value: student.profile_id ? t("common.yes") : t("common.no") },
                { label: t("students.notes"), value: student.notes ?? t("common.missing") },
              ]}
            />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t("students.progress")} />
          {progress.length === 0 ? (
            <EmptyState title={t("portal.empty")} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("assignments.titleField")}</Th>
                  <Th>{t("assignments.deadline")}</Th>
                  <Th>{t("common.status")}</Th>
                  <Th>{t("grading.finalScore")}</Th>
                </tr>
              </thead>
              <tbody>
                {progress.map((p) => (
                  <tr key={p.assignment.id}>
                    <Td>
                      <Link href={p.submission ? `/submissions/${p.submission.id}` : `/assignments/${p.assignment.id}`} className="font-medium hover:text-primary">
                        {p.assignment.title}
                      </Link>
                      <p className="text-xs text-muted">{subjectName(p.subject, ctx.locale)}</p>
                    </Td>
                    <Td className="whitespace-nowrap">{formatDate(p.assignment.deadline, ctx.locale)}</Td>
                    <Td>
                      <Badge tone={WORK_STATUS_TONE[p.status]}>{t(`workStatus.${p.status}`)}</Badge>
                    </Td>
                    <Td className="tabular-nums">{p.finalScore === null ? t("common.missing") : `${formatNumber(p.finalScore, ctx.locale)} / ${p.assignment.max_score}`}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
