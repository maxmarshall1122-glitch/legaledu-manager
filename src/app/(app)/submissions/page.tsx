import Link from "next/link";
import { FileStack } from "lucide-react";
import { FilterBar, FilterField } from "@/components/list-controls";
import { Badge, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { uploadLimits } from "@/lib/config";
import { formatDate } from "@/lib/format";
import { listAssignments } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { listGroups } from "@/lib/services/groups";
import { eligibleStudentsByAssignment, listSubmissions } from "@/lib/services/submissions";
import { listSubjects } from "@/lib/services/subjects";
import { SUBMISSION_STATUSES } from "@/lib/types";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { UploadDialog } from "./upload-dialog";

export const generateMetadata = titled("nav.submissions");

export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const sp = await searchParams;
  const [rows, assignments, subjects, groups] = await Promise.all([
    listSubmissions(ctx, { q: sp.q, assignment: sp.assignment, subject: sp.subject, group: sp.group, status: sp.status }),
    listAssignments(ctx),
    listSubjects(ctx),
    listGroups(ctx),
  ]);
  const open = assignments.filter((a) => a.assignment.status !== "archived");
  const eligible = await eligibleStudentsByAssignment(ctx, open.map((a) => a.assignment.id));
  const studentsByAssignment = Object.fromEntries(
    Object.entries(eligible).map(([id, list]) => [id, list.map((s) => ({ id: s.id, label: `${s.student_code} — ${s.full_name}` }))]),
  );
  const limits = uploadLimits();

  return (
    <>
      <PageHeader
        title={t("submissions.title")}
        description={t("submissions.subtitle")}
        actions={
          <UploadDialog
            assignments={open.map((a) => ({ id: a.assignment.id, label: `${a.assignment.code} — ${a.assignment.title}` }))}
            studentsByAssignment={studentsByAssignment}
            defaultAssignmentId={sp.assignment}
            autoOpen={sp.upload === "1"}
            maxMb={Math.round(limits.maxFileBytes / 1024 / 1024)}
            maxFiles={limits.maxFilesPerSubmission}
          />
        }
      />
      <Card>
        <FilterBar t={t} resetHref="/submissions">
          <FilterField label={t("common.search")} htmlFor="q" className="sm:min-w-56">
            <Input id="q" name="q" type="search" defaultValue={sp.q} maxLength={100} />
          </FilterField>
          <FilterField label={t("submissions.assignment")} htmlFor="assignment">
            <Select id="assignment" name="assignment" defaultValue={sp.assignment ?? ""}>
              <option value="">{t("common.all")}</option>
              {assignments.map((a) => (
                <option key={a.assignment.id} value={a.assignment.id}>
                  {a.assignment.code} — {a.assignment.title.slice(0, 40)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("assignments.subject")} htmlFor="subject">
            <Select id="subject" name="subject" defaultValue={sp.subject ?? ""}>
              <option value="">{t("common.all")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(s, L)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("students.group")} htmlFor="group">
            <Select id="group" name="group" defaultValue={sp.group ?? ""}>
              <option value="">{t("common.all")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("common.status")} htmlFor="status">
            <Select id="status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">{t("common.all")}</option>
              {SUBMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`workStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<FileStack className="h-10 w-10" />} title={t("submissions.empty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("submissions.code")}</Th>
                <Th>{t("submissions.student")}</Th>
                <Th>{t("submissions.assignment")}</Th>
                <Th>{t("submissions.submittedAt")}</Th>
                <Th>{t("submissions.version")}</Th>
                <Th>{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.submission.id} className="hover:bg-surface-muted/60">
                  <Td className="font-mono text-xs">
                    <Link href={`/submissions/${r.submission.id}`} className="font-semibold text-primary hover:underline">
                      {r.submission.code}
                    </Link>
                  </Td>
                  <Td>
                    <span className="font-mono text-xs">{r.student?.student_code}</span>
                    <p className="text-sm">{r.student?.full_name}</p>
                  </Td>
                  <Td>
                    <span className="text-sm">{r.assignment.title}</span>
                    <p className="text-xs text-muted">{subjectName(r.subject, L)}</p>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(r.submission.submitted_at, L, true)}
                    {r.submission.is_late && (
                      <span className="ml-1">
                        <Badge tone="warning">{t("common.late")}</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    v{r.submission.current_version} · {r.fileCount} {t("common.files").toLowerCase()}
                  </Td>
                  <Td>
                    <Badge tone={WORK_STATUS_TONE[r.submission.status]}>{t(`workStatus.${r.submission.status}`)}</Badge>
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
