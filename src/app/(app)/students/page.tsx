import Link from "next/link";
import { Users } from "lucide-react";
import { FilterBar, FilterField, Pagination, SortHeader } from "@/components/list-controls";
import { Badge, Card, EmptyState, Input, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { listGroups } from "@/lib/services/groups";
import { listStudents, type StudentSort } from "@/lib/services/students";
import { ENROLLMENT_STATUSES } from "@/lib/types";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { StudentFormDialog } from "./student-form";

export const generateMetadata = titled("nav.students");

const SORTS: StudentSort[] = ["student_code", "full_name", "academic_year", "enrollment_status", "created_at"];

export default async function StudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const sp = await searchParams;
  const sort = SORTS.includes(sp.sort as StudentSort) ? (sp.sort as StudentSort) : "student_code";
  const dir: "asc" | "desc" = sp.dir === "desc" ? "desc" : "asc";
  const params = { q: sp.q, group: sp.group, status: sp.status, year: sp.year, sort, dir };
  const [result, groups] = await Promise.all([
    listStudents(ctx, { ...params, page: Number(sp.page) || 1 }),
    listGroups(ctx),
  ]);
  const filtered = Boolean(sp.q || sp.group || sp.status || sp.year);
  const sh = (label: string, column: StudentSort) => <SortHeader label={label} column={column} current={sort} dir={dir} base="/students" params={params} />;

  return (
    <>
      <PageHeader title={t("students.title")} description={t("students.subtitle")} actions={<StudentFormDialog groups={groups} autoOpen={sp.new === "1"} />} />
      <Card>
        <FilterBar t={t} resetHref="/students">
          <FilterField label={t("common.search")} htmlFor="q" className="sm:min-w-64">
            <Input id="q" name="q" type="search" defaultValue={sp.q} maxLength={100} />
          </FilterField>
          <FilterField label={t("students.group")} htmlFor="group">
            <Select id="group" name="group" defaultValue={sp.group ?? ""}>
              <option value="">{t("common.all")}</option>
              <option value="none">{t("students.noGroup")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("students.enrollmentStatus")} htmlFor="status">
            <Select id="status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">{t("common.all")}</option>
              {ENROLLMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`enrollment.${s}`)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("students.academicYear")} htmlFor="year">
            <Select id="year" name="year" defaultValue={sp.year ?? ""}>
              <option value="">{t("common.all")}</option>
              {result.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {result.rows.length === 0 ? (
          <EmptyState icon={<Users className="h-10 w-10" />} title={filtered ? t("students.empty") : t("students.emptyAll")} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{sh(t("students.studentCode"), "student_code")}</Th>
                  <Th>{sh(t("students.fullName"), "full_name")}</Th>
                  <Th>{t("students.group")}</Th>
                  <Th>{sh(t("students.academicYear"), "academic_year")}</Th>
                  <Th>{sh(t("students.enrollmentStatus"), "enrollment_status")}</Th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-muted/60">
                    <Td className="font-mono text-xs">
                      <Link href={`/students/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.student_code}
                      </Link>
                    </Td>
                    <Td>
                      <Link href={`/students/${s.id}`} className="hover:text-primary">
                        {s.full_name}
                      </Link>
                      {s.email && <p className="text-xs text-muted">{s.email}</p>}
                    </Td>
                    <Td>{s.groups.length ? s.groups.map((g) => g.name).join(", ") : <span className="text-muted">{t("students.noGroup")}</span>}</Td>
                    <Td className="tabular-nums">{s.academic_year}</Td>
                    <Td>
                      <Badge tone={s.enrollment_status === "active" ? "success" : s.enrollment_status === "withdrawn" ? "danger" : "neutral"}>{t(`enrollment.${s.enrollment_status}`)}</Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination t={t} page={result.page} pages={result.pages} total={result.total} pageSize={result.pageSize} base="/students" params={params} />
          </>
        )}
      </Card>
    </>
  );
}
