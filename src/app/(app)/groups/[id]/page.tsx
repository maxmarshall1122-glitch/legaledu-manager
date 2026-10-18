import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteGroupAction } from "@/app/actions/records";
import { ConfirmButton } from "@/components/client-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { subjectName } from "@/lib/services/core";
import { getGroupDetail } from "@/lib/services/groups";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { AddMemberForm, GroupFormDialog, RemoveMemberButton } from "../group-form";

export const generateMetadata = titled("nav.groups");

export default async function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const { id } = await params;
  const { group, members, nonMembers, subjects } = await orNotFound(getGroupDetail(ctx, id));
  return (
    <>
      <PageHeader
        title={group.name}
        description={`${t("groups.academicYear")}: ${group.academic_year}${group.description ? ` · ${group.description}` : ""}`}
        back={{ href: "/groups", label: t("groups.title") }}
        actions={
          <>
            <GroupFormDialog group={group} />
            <ConfirmButton
              label={t("common.delete")}
              icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              title={t("groups.deleteTitle")}
              body={t("groups.deleteBody", { name: group.name })}
              confirmLabel={t("confirm.deleteConfirm")}
              action={deleteGroupAction.bind(null, group.id)}
              redirectTo="/groups"
            />
          </>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={`${t("groups.members")} (${members.length})`} />
          <CardBody className="border-b border-border">
            <AddMemberForm groupId={group.id} candidates={nonMembers} />
          </CardBody>
          {members.length === 0 ? (
            <EmptyState title={t("groups.emptyMembers")} />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t("students.studentCode")}</Th>
                  <Th>{t("students.fullName")}</Th>
                  <Th>{t("students.enrollmentStatus")}</Th>
                  <Th className="text-right">{t("common.actions")}</Th>
                </tr>
              </thead>
              <tbody>
                {members.map((s) => (
                  <tr key={s.id}>
                    <Td className="font-mono text-xs">
                      <Link href={`/students/${s.id}`} className="font-semibold text-primary hover:underline">
                        {s.student_code}
                      </Link>
                    </Td>
                    <Td>{s.full_name}</Td>
                    <Td>
                      <Badge tone={s.enrollment_status === "active" ? "success" : "neutral"}>{t(`enrollment.${s.enrollment_status}`)}</Badge>
                    </Td>
                    <Td className="text-right">
                      <RemoveMemberButton groupId={group.id} studentId={s.id} name={s.full_name} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title={t("groups.subjects")} />
          <CardBody>
            {subjects.length === 0 ? (
              <p className="text-sm text-muted">{t("common.none")}</p>
            ) : (
              <ul className="space-y-2">
                {subjects.map((s) => (
                  <li key={s!.id}>
                    <Link href={`/subjects/${s!.id}`} className="text-sm font-medium hover:text-primary">
                      {subjectName(s, ctx.locale)}
                    </Link>
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
