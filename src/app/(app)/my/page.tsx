import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { daysUntil, formatDate } from "@/lib/format";
import { listAssignmentsForStudent } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("portal.title");

export default async function MyAssignmentsPage() {
  const ctx = await requirePageCtx(["student"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const rows = await listAssignmentsForStudent(ctx);
  return (
    <>
      <PageHeader title={t("portal.title")} description={t("portal.subtitle")} />
      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={<FolderOpen className="h-10 w-10" />} title={t("portal.empty")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {rows.map(({ assignment: a, subject, status, submission }) => {
            const days = a.deadline ? daysUntil(a.deadline) : null;
            return (
              <li key={a.id}>
                <Card className="h-full p-5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted">{subjectName(subject, L)}</p>
                    <Badge tone={WORK_STATUS_TONE[status]}>{t(`workStatus.${status}`)}</Badge>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold" lang={a.language}>
                    <Link href={`/my/assignments/${a.id}`} className="hover:text-primary">
                      {a.title}
                    </Link>
                  </h2>
                  <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                    {t("portal.deadline")}: <span className="font-medium text-foreground">{formatDate(a.deadline, L, true)}</span>
                    {days !== null && !submission && (
                      <Badge tone={days < 0 ? "danger" : days <= 2 ? "warning" : "neutral"}>{days < 0 ? t("common.overdue") : days === 0 ? t("common.dueToday") : t("common.daysLeft", { n: days })}</Badge>
                    )}
                  </p>
                  {status === "revision_required" && submission?.revision_deadline && (
                    <p className="mt-2 text-sm text-warning">{t("portal.revisionRequested", { date: formatDate(submission.revision_deadline, L, true) })}</p>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
