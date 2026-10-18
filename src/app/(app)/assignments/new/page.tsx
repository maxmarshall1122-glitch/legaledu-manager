import { PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { listGroups } from "@/lib/services/groups";
import { listMaterials } from "@/lib/services/materials";
import { listSubjects } from "@/lib/services/subjects";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { AssignmentForm } from "../assignment-form";

export const generateMetadata = titled("assignments.createTitle");

export default async function NewAssignmentPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const sp = await searchParams;
  const [subjects, groups, materials] = await Promise.all([listSubjects(ctx), listGroups(ctx), listMaterials(ctx)]);
  return (
    <>
      <PageHeader title={t("assignments.createTitle")} back={{ href: "/assignments", label: t("assignments.title") }} />
      <AssignmentForm subjects={subjects} groups={groups} materials={materials.map((m) => m.material)} defaultSubjectId={sp.subject} />
    </>
  );
}
