import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatNumber } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { listGroups } from "@/lib/services/groups";
import { listSubjectsWithStats } from "@/lib/services/subjects";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { SubjectFormDialog } from "./subject-form";

export const generateMetadata = titled("nav.subjects");

export default async function SubjectsPage() {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const [subjects, groups] = await Promise.all([listSubjectsWithStats(ctx), listGroups(ctx)]);
  const L = ctx.locale;
  return (
    <>
      <PageHeader title={t("subjects.title")} description={t("subjects.subtitle")} actions={<SubjectFormDialog groups={groups} />} />
      {subjects.length === 0 ? (
        <Card>
          <EmptyState icon={<BookOpen className="h-10 w-10" />} title={t("subjects.empty")} />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.subject.id}>
              <Card className="flex h-full flex-col p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">{s.subject.code}</p>
                    <h2 className="mt-0.5 text-lg font-semibold">
                      <Link href={`/subjects/${s.subject.id}`} className="hover:text-primary">
                        {subjectName(s.subject, L)}
                      </Link>
                    </h2>
                    <p className="text-sm text-muted" lang={L === "uz" ? "en" : "uz"}>
                      {L === "uz" ? s.subject.name_en : s.subject.name_uz}
                    </p>
                  </div>
                  {s.subject.is_default && <Badge tone="primary">{t("subjects.predefined")}</Badge>}
                </div>
                <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted">{(L === "uz" ? s.subject.description_uz : s.subject.description_en) ?? ""}</p>
                <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-border pt-3 text-center">
                  {[
                    [t("subjects.assignmentsCount"), s.assignmentCount],
                    [t("subjects.submissionsCount"), s.submissionCount],
                    [t("subjects.gradedCount"), s.gradedCount],
                    [t("subjects.averageScore"), s.averagePercent === null ? t("common.missing") : `${formatNumber(s.averagePercent, L)}%`],
                  ].map(([label, value]) => (
                    <div key={String(label)}>
                      <dt className="text-[11px] leading-tight text-muted">{label}</dt>
                      <dd className="text-sm font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-xs text-muted">
                  {t("subjects.assignedGroups")}: {s.groups.length ? s.groups.map((g) => g.name).join(", ") : t("common.none")}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
