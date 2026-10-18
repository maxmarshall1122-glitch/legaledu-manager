import { Download, ExternalLink, Library } from "lucide-react";
import { FilterBar, FilterField } from "@/components/list-controls";
import { Badge, Card, EmptyState, PageHeader, Select, Table, Td, Th } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { uploadLimits } from "@/lib/config";
import { formatBytes, formatDate } from "@/lib/format";
import { listAssignments } from "@/lib/services/assignments";
import { subjectName } from "@/lib/services/core";
import { listMaterials } from "@/lib/services/materials";
import { listSubjects } from "@/lib/services/subjects";
import { makeT } from "@/i18n";
import { titled } from "@/lib/page-meta";
import { AddMaterialDialog, MaterialRowActions } from "./material-controls";

export const generateMetadata = titled("nav.materials");

export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const ctx = await requirePageCtx(["admin", "lecturer"]);
  const t = makeT(ctx.locale);
  const L = ctx.locale;
  const sp = await searchParams;
  const [rows, subjects, assignments] = await Promise.all([listMaterials(ctx, { subject: sp.subject }), listSubjects(ctx), listAssignments(ctx)]);
  return (
    <>
      <PageHeader
        title={t("materials.title")}
        description={t("materials.subtitle")}
        actions={
          <AddMaterialDialog
            subjects={subjects.map((s) => ({ id: s.id, label: subjectName(s, L) }))}
            assignments={assignments.map((a) => ({ id: a.assignment.id, label: `${a.assignment.code} — ${a.assignment.title}`, subject_id: a.assignment.subject_id }))}
            defaultSubjectId={sp.subject}
            maxMb={Math.round(uploadLimits().maxFileBytes / 1024 / 1024)}
          />
        }
      />
      <Card>
        <FilterBar t={t} resetHref="/materials">
          <FilterField label={t("materials.subject")} htmlFor="subject">
            <Select id="subject" name="subject" defaultValue={sp.subject ?? ""}>
              <option value="">{t("common.all")}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {subjectName(s, L)}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={<Library className="h-10 w-10" />} title={t("materials.empty")} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>{t("materials.titleField")}</Th>
                <Th>{t("materials.subject")}</Th>
                <Th>{t("materials.assignment")}</Th>
                <Th>{t("common.file")}</Th>
                <Th>{t("common.status")}</Th>
                <Th className="text-right">{t("common.actions")}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ material: m, subject, assignment }) => (
                <tr key={m.id}>
                  <Td>
                    <span className="font-medium">{m.title}</span>
                    {m.description && <p className="text-xs text-muted">{m.description}</p>}
                    <p className="text-xs text-muted">{formatDate(m.created_at, L)}</p>
                  </Td>
                  <Td>{subjectName(subject, L)}</Td>
                  <Td>{assignment ? assignment.code : <span className="text-muted">{t("materials.noAssignment")}</span>}</Td>
                  <Td>
                    {m.storage_key ? (
                      <a href={`/api/materials/${m.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download className="h-4 w-4" aria-hidden="true" />
                        {m.original_name} <span className="text-xs text-muted">({formatBytes(m.size_bytes)})</span>
                      </a>
                    ) : m.external_url ? (
                      <a href={m.external_url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        {new URL(m.external_url).hostname}
                      </a>
                    ) : (
                      t("common.missing")
                    )}
                  </Td>
                  <Td>
                    <Badge tone={m.visible_to_students ? "success" : "neutral"}>{m.visible_to_students ? t("materials.visible") : t("materials.hidden")}</Badge>
                  </Td>
                  <Td>
                    <MaterialRowActions id={m.id} title={m.title} visible={m.visible_to_students} />
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
