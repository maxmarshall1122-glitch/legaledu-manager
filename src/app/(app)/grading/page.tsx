import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th, WORK_STATUS_TONE, cn } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { getGradingQueue } from "@/lib/services/grading";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("nav.grading");

const FILTERS = ["awaiting", "revision", "graded", "all"] as const;
type Filter = (typeof FILTERS)[number];

export default async function GradingPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const sp = await searchParams;
  const filter: Filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : "awaiting";
  const rows = await getGradingQueue(ctx, filter);
  return (
    <>
      <PageHeader title={t("grading.title")} description={t("grading.subtitle")} />
      <nav aria-label={t("common.filters")} className="mb-4 flex flex-wrap gap-1 rounded-lg border border-border bg-surface p-1">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/grading?filter=${f}`}
            aria-current={filter === f ? "page" : undefined}
            className={cn("rounded-md px-3 py-1.5 text-sm font-medium", filter === f ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-muted hover:text-foreground")}
          >
            {t(`grading.filters.${f}`)}
          </Link>
        ))}
      </nav>
      <Card>
        {rows.length === 0 ? (
          <EmptyState icon={<ClipboardCheck className="h-10 w-10" />} title={t("grading.queueEmpty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("submissions.student")}</Th>
                <Th>{t("submissions.assignment")}</Th>
                <Th>{t("submissions.submittedAt")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.submission.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <span className="font-mono text-xs">{r.student?.student_code}</span>
                    <p>{r.student?.full_name}</p>
                  </Td>
                  <Td>
                    {r.assignment.title}
                    <p className="text-xs text-muted">{subjectName(r.subject, L)}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(r.submission.submitted_at, L, true)} {r.submission.is_late && <Badge tone="warning">{t("common.late")}</Badge>}
                  </Td>
                  <Td>
                    <Badge tone={WORK_STATUS_TONE[r.submission.status]}>{t(`workStatus.${r.submission.status}`)}</Badge>
                  </Td>
                  <Td className="text-right">
                    <Link href={`/grading/${r.submission.id}`} className="font-medium text-primary hover:underline">
                      {t("submissions.grade")}
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
