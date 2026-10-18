import { BarChart3, FileDown, FileSpreadsheet } from "lucide-react";
import { FilterBar, FilterField, qs } from "@/components/list-controls";
import { buttonClass, Card, CardHeader, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { displayCell } from "@/lib/report-format";
import { listAssignments } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { listGroups } from "@/lib/services/groups";
import { buildReport, REPORT_TYPES, type ReportType } from "@/lib/services/reports";
import { listSubjects } from "@/lib/services/subjects";
import { WORK_STATUSES } from "@/lib/types";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("nav.reports");

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const sp = await searchParams;
  const type: ReportType = REPORT_TYPES.includes(sp.type as ReportType) ? (sp.type as ReportType) : "register";
  const filters = { subject: sp.subject, group: sp.group, assignment: sp.assignment, status: sp.status, from: sp.from, to: sp.to };
  const [report, subjects, groups, assignments] = await Promise.all([buildReport(ctx, type, filters, L), listSubjects(ctx), listGroups(ctx), listAssignments(ctx)]);
  const exportQs = qs({ type, ...filters });
  return (
    <>
      <PageHeader
        title={t("reports.title")}
        description={t("reports.subtitle")}
        actions={
          <>
            <a href={`/api/reports${exportQs}`} className={buttonClass("outline", "sm")} download>
              <FileDown className="h-4 w-4" aria-hidden="true" />
              {t("common.exportCsv")}
            </a>
            <a href={`/api/reports${exportQs}&format=excel`} className={buttonClass("outline", "sm")} download>
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              {t("common.exportExcel")}
            </a>
          </>
        }
      />
      <Card>
        <FilterBar t={t} resetHref={`/reports?type=${type}`}>
          <FilterField label={t("reports.type")} htmlFor="type" className="sm:min-w-64">
            <Select id="type" name="type" defaultValue={type}>
              {REPORT_TYPES.map((r) => (
                <option key={r} value={r}>
                  {t(`reports.types.${r}`)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("reports.subject")} htmlFor="subject">
            <Select id="subject" name="subject" defaultValue={sp.subject ?? ""}>
              <option value="">{t("common.all")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(s, L)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("reports.group")} htmlFor="group">
            <Select id="group" name="group" defaultValue={sp.group ?? ""}>
              <option value="">{t("common.all")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("reports.assignment")} htmlFor="assignment">
            <Select id="assignment" name="assignment" defaultValue={sp.assignment ?? ""}>
              <option value="">{t("common.all")}</option>
              {assignments.map((a) => (
                <option key={a.assignment.id} value={a.assignment.id}>
                  {a.assignment.code} — {a.assignment.title.slice(0, 40)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("reports.status")} htmlFor="status">
            <Select id="status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">{t("common.all")}</option>
              {WORK_STATUSES.filter((s) => s !== "not_assigned").map((s) => (
                <option key={s} value={s}>
                  {t(`workStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("reports.dateFrom")} htmlFor="from">
            <Input id="from" name="from" type="date" defaultValue={sp.from} />
          </FilterField>
          <FilterField label={t("reports.dateTo")} htmlFor="to">
            <Input id="to" name="to" type="date" defaultValue={sp.to} />
          </FilterField>
        </FilterBar>
        <CardHeader title={t(`reports.types.${type}`)} description={t("reports.rows", { n: report.rows.length })} className="border-b-0" />
        {report.rows.length === 0 ? (
          <EmptyState icon={<BarChart3 className="h-10 w-10" />} title={t("reports.empty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                {report.columns.map((c) => (
                  <Th key={c.key} className={c.kind === "number" ? "text-right" : undefined}>
                    {t(`reports.columns.${c.key as "studentCode"}`)}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((v, j) => (
                    <Td key={j} className={report.columns[j].kind === "number" ? "text-right tabular-nums" : undefined}>
                      {displayCell(t, L, report.columns[j], v)}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
