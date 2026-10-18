import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  FilePlus2,
  FileStack,
  GraduationCap,
  Hourglass,
  NotebookPen,
  Percent,
  RotateCcw,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { ProgressMeter, StatusChart, WorkloadChart } from "@/components/charts";
import { Badge, Card, CardBody, CardHeader, LinkButton, PageHeader, StatCard } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { daysUntil, formatDate, formatNumber } from "@/lib/format";
import { subjectName } from "@/lib/services/core";
import { getDashboard } from "@/lib/services/dashboard";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("nav.dashboard");

export default async function DashboardPage() {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const d = await getDashboard(ctx);
  const L = ctx.locale;

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")} />

      <section aria-labelledby="shortcuts" className="mb-6">
        <h2 id="shortcuts" className="sr-only">
          {t("dashboard.shortcuts")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/assignments/new">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.newAssignment")}
          </LinkButton>
          <LinkButton href="/students?new=1" variant="outline">
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.addStudent")}
          </LinkButton>
          <LinkButton href="/submissions?upload=1" variant="outline">
            <Upload className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.uploadSubmission")}
          </LinkButton>
          <LinkButton href="/grading" variant="outline">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            {t("dashboard.reviewOutstanding")}
          </LinkButton>
        </div>
      </section>

      <section aria-label={t("dashboard.title")} className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatCard label={t("dashboard.totalStudents")} value={d.totals.students} icon={<Users className="h-4 w-4" />} href="/students" />
        <StatCard label={t("dashboard.totalGroups")} value={d.totals.groups} icon={<GraduationCap className="h-4 w-4" />} href="/groups" />
        <StatCard label={t("dashboard.activeAssignments")} value={d.totals.activeAssignments} icon={<NotebookPen className="h-4 w-4" />} href="/assignments?status=published" />
        <StatCard label={t("dashboard.submittedPapers")} value={d.totals.submitted} icon={<FileStack className="h-4 w-4" />} href="/submissions" />
        <StatCard label={t("dashboard.awaitingReview")} value={d.totals.awaitingReview} icon={<Hourglass className="h-4 w-4" />} href="/grading?filter=awaiting" />
        <StatCard label={t("dashboard.requiringRevision")} value={d.totals.revision} icon={<RotateCcw className="h-4 w-4" />} href="/grading?filter=revision" />
        <StatCard label={t("dashboard.completedGrading")} value={d.totals.completedGrading} icon={<CheckCircle2 className="h-4 w-4" />} href="/grading?filter=graded" />
        <StatCard
          label={t("dashboard.averageScore")}
          value={d.totals.averagePercent === null ? t("common.missing") : `${formatNumber(d.totals.averagePercent, L)}%`}
          hint={d.totals.averagePercent === null ? t("dashboard.noScoresYet") : t("dashboard.averageScoreHint")}
          icon={<Percent className="h-4 w-4" />}
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t("dashboard.workloadChart")} />
          <CardBody>
            <WorkloadChart data={d.workload.map((w) => ({ label: subjectName(w.subject, L), assignments: w.assignments, submissions: w.submissions }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.gradingProgressChart")} />
          <CardBody>
            <ProgressMeter graded={d.grading.graded} total={d.grading.graded + d.grading.ungraded} />
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t("dashboard.submissionStatusChart")} />
          <CardBody>
            <StatusChart data={d.statusChart.map((s) => ({ label: t(`workStatus.${s.status}`), count: s.count }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("dashboard.upcomingDeadlines")} />
          <CardBody className="p-0">
            {d.upcoming.length === 0 && d.revisionDeadlines.length === 0 ? (
              <p className="p-5 text-sm text-muted">{t("dashboard.noUpcoming")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.upcoming.map(({ assignment, subject }) => {
                  const days = daysUntil(assignment.deadline!);
                  return (
                    <li key={assignment.id} className="px-5 py-3">
                      <Link href={`/assignments/${assignment.id}`} className="font-medium text-foreground hover:text-primary">
                        {assignment.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span>{subjectName(subject, L)}</span>·<span>{formatDate(assignment.deadline, L, true)}</span>
                        <Badge tone={days <= 2 ? "warning" : "neutral"}>{days <= 0 ? t("common.dueToday") : t("common.daysLeft", { n: days })}</Badge>
                      </p>
                    </li>
                  );
                })}
                {d.revisionDeadlines.map(({ submission, assignment }) => (
                  <li key={submission.id} className="px-5 py-3">
                    <Link href={`/submissions/${submission.id}`} className="font-medium text-foreground hover:text-primary">
                      {submission.code} · {assignment?.title}
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge tone="warning">{t("workStatus.revision_required")}</Badge>
                      <span>{formatDate(submission.revision_deadline, L, true)}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title={t("dashboard.followUps")} />
          <CardBody className="p-0">
            {d.followUps.length === 0 ? (
              <p className="p-5 text-sm text-muted">{t("dashboard.noFollowUps")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {d.followUps.map(({ submission, assignment, student }) => (
                  <li key={submission.id} className="flex flex-wrap items-start justify-between gap-2 px-5 py-3">
                    <div className="min-w-0">
                      <Link href={`/submissions/${submission.id}`} className="font-medium text-foreground hover:text-primary">
                        {submission.code} · {student?.student_code} · {assignment?.title}
                      </Link>
                      <p className="mt-0.5 text-sm text-muted">{submission.follow_up_note}</p>
                    </div>
                    {submission.follow_up_due && (
                      <Badge tone={submission.follow_up_due < new Date().toISOString() ? "danger" : "neutral"}>
                        <AlertCircle className="h-3 w-3" aria-hidden="true" />
                        {formatDate(submission.follow_up_due, L)}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
