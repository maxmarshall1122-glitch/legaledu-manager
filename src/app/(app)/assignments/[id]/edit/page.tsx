import { PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { getAssignmentDetail } from "@/lib/services/assignments";
import { listMaterials } from "@/lib/services/materials";
import { listSubjects } from "@/lib/services/subjects";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";
import { AssignmentForm } from "../../assignment-form";

export const generateMetadata = titled("assignments.editTitle");

export default async function EditAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const { id } = await params;
  const [d, subjects, materials] = await Promise.all([orNotFound(getAssignmentDetail(ctx, id)), listSubjects(ctx), listMaterials(ctx)]);
  return (
    <>
      <PageHeader title={t("assignments.editTitle")} description={`${d.assignment.code} · ${d.assignment.title}`} back={{ href: `/assignments/${id}`, label: d.assignment.code }} />
      <AssignmentForm
        subjects={subjects}
        groups={d.allGroups}
        materials={materials.map((m) => m.material)}
        assignment={d.assignment}
        criteria={d.criteria}
        groupIds={d.groups.map((g) => g.id)}
      />
    </>
  );
}
