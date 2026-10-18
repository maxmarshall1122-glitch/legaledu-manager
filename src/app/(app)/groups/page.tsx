import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { listGroups } from "@/lib/services/groups";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { GroupFormDialog } from "./group-form";

export const generateMetadata = titled("nav.groups");

export default async function GroupsPage() {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const groups = await listGroups(ctx);
  return (
    <>
      <PageHeader title={t("groups.title")} description={t("groups.subtitle")} actions={<GroupFormDialog />} />
      <Card>
        {groups.length === 0 ? (
          <EmptyState icon={<GraduationCap className="h-10 w-10" />} title={t("groups.empty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("groups.name")}</Th>
                <Th>{t("groups.academicYear")}</Th>
                <Th>{t("groups.students")}</Th>
                <Th>{t("groups.subjects")}</Th>
                <Th>{t("groups.description")}</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.id} className="hover:bg-surface-muted/60">
                  <Td>
                    <Link href={`/groups/${g.id}`} className="font-semibold text-primary hover:underline">
                      {g.name}
                    </Link>
                  </Td>
                  <Td className="tabular-nums">{g.academic_year}</Td>
                  <Td className="tabular-nums">{g.studentCount}</Td>
                  <Td className="tabular-nums">{g.subjectCount}</Td>
                  <Td className="text-muted">{g.description ?? t("common.missing")}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
