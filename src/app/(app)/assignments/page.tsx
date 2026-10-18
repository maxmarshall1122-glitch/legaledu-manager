import Link from "next/link";
import { FilePlus2, NotebookPen } from "lucide-react";
import { FilterBar, FilterField } from "@/components/list-controls";
import { Badge, Card, EmptyState, Input, LinkButton, PageHeader, Select, Table, Td, Th, WORK_STATUS_TONE } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatDate } from "@/lib/format";
import { listAssignments } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { listGroups } from "@/lib/services/groups";
import { listSubjects } from "@/lib/services/subjects";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES } from "@/lib/types";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";

export const generateMetadata = titled("nav.assignments");

export default async function AssignmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const sp = await searchParams;
  const [rows, subjects, groups] = await Promise.all([
    listAssignments(ctx, { q: sp.q, subject: sp.subject, status: sp.status, group: sp.group, type: sp.type }),
    listSubjects(ctx),
    listGroups(ctx),
  ]);
  const now = new Date().toISOString();
  return (
    <>
      <PageHeader
        title={t("assignments.title")}
        description={t("assignments.subtitle")}
        actions={
          <LinkButton href="/assignments/new">
            <FilePlus2 className="h-4 w-4" aria-hidden="true" />
            {t("assignments.add")}
          </LinkButton>
        }
      />
      <Card>
        <FilterBar t={t} resetHref="/assignments">
          <FilterField label={t("common.search")} htmlFor="q" className="sm:min-w-56">
            <Input id="q" name="q" type="search" defaultValue={sp.q} maxLength={100} />
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
          <FilterField label={t("assignments.targetGroups")} htmlFor="group">
            <Select id="group" name="group" defaultValue={sp.group ?? ""}>
              <option value="">{t("common.all")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("assignments.type")} htmlFor="type">
            <Select id="type" name="type" defaultValue={sp.type ?? ""}>
              <option value="">{t("common.all")}</option>
              {ASSIGNMENT_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`assignmentType.${ty}`)}
                </option>
              ))}
            </Select>
          </FilterField>
          <FilterField label={t("common.status")} htmlFor="status">
            <Select id="status" name="status" defaultValue={sp.status ?? ""}>
              <option value="">{t("common.all")}</option>
              {ASSIGNMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`assignmentStatus.${s}`)}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<NotebookPen className="h-10 w-10" />} title={t("assignments.empty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("assignments.code")}</Th>
                <Th>{t("assignments.titleField")}</Th>
                <Th>{t("assignments.targetGroups")}</Th>
                <Th>{t("assignments.deadline")}</Th>
                <Th>{t("submissions.title")}</Th>
                <Th>{t("common.status")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ assignment: a, subject, groups: gs, expected, submitted }) => (
                <tr key={a.id} className="hover:bg-surface-muted/60">
                  <Td className="font-mono text-xs">{a.code}</Td>
                  <Td>
                    <Link href={`/assignments/${a.id}`} className="font-medium text-foreground hover:text-primary">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {subjectName(subject, L)} · {t(`assignmentType.${a.assignment_type}`)} · {a.language.toUpperCase()}
                    </p>
                  </Td>
                  <Td>{gs.length ? gs.map((g) => g.name).join(", ") : <span className="text-muted">{t("common.none")}</span>}</Td>
                  <Td className="whitespace-nowrap">
                    {formatDate(a.deadline, L, true)}
                    {a.status === "published" && a.deadline && a.deadline < now && (
                      <span className="ml-1">
                        <Badge tone="warning">{t("common.overdue")}</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="tabular-nums">
                    {submitted} / {expected}
                  </Td>
                  <Td>
                    <Badge tone={WORK_STATUS_TONE[a.status]}>{t(`assignmentStatus.${a.status}`)}</Badge>
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
