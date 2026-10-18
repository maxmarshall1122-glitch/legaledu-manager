import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatNumber } from "@/lib/format";
import { getAssignmentForStudent, listAssignmentsForStudent } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("portal.feedbackTitle");

/** A student's own released feedback and approved scores only. */
export default async function MyFeedbackPage() {
  const ctx = await requirePageCtx(["student"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const mine = (await listAssignmentsForStudent(ctx)).filter((m) => m.submission);
  const details = await Promise.all(mine.map((m) => getAssignmentForStudent(ctx, m.assignment.id)));
  const rows = details.filter((d) => d.released.length > 0);
  return (
    <>
      <PageHeader title={t("portal.feedbackTitle")} />
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-10 w-10" />} title={t("portal.noFeedback")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("submissions.assignment")}</Th>
                <Th>{t("common.status")}</Th>
                <Th>{t("portal.finalScore")}</Th>
                <Th>{t("portal.feedback")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const latest = d.released[0];
                return (
                  <tr key={d.assignment.id}>
                    <Td>
                      <Link href={`/my/assignments/${d.assignment.id}`} className="font-medium hover:text-primary">
                        {d.assignment.title}
                      </Link>
                      <p className="text-xs text-muted">{subjectName(d.subject, L)}</p>
                    </Td>
                    <Td>
                      <Badge tone={WORK_STATUS_TONE[d.status]}>{t(`workStatus.${d.status}`)}</Badge>
                    </Td>
                    <Td className="tabular-nums">{latest.final_score === null ? t("common.missing") : `${formatNumber(latest.final_score, L, 2)} / ${d.assignment.max_score}`}</Td>
                    <Td className="max-w-md text-sm" lang={d.assignment.language}>
                      <p className="line-clamp-3">{latest.student_feedback ?? t("common.missing")}</p>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
