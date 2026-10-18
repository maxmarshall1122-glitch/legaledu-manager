import { Download } from "lucide-react";
import { Alert, Card, CardBody, LinkButton, PageHeader } from "@/components/ui";
import { requirePageCtx } from "@/lib/auth/server";
import { formatBytes } from "@/lib/format";
import { isStaff } from "@/lib/services/core";
import { previewFileText } from "@/lib/services/submissions";
import { makeT } from "@/i18n";
import { orNotFound, titled } from "@/lib/page-meta";

export const generateMetadata = titled("common.preview");

/**
 * Safe preview: PDFs are shown in a sandboxed frame; DOCX/PPTX/TXT are shown
 * as extracted plain text (no student-supplied markup or scripts are ever rendered).
 */
export default async function FilePreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageCtx();
  const t = makeT(ctx.locale);
  const { id } = await params;
  const { file, text, truncated } = await orNotFound(previewFileText(ctx, id));
  const back = isStaff(ctx.user) ? `/submissions/${file.submission_id}` : "/my";
  const isPdf = file.mime_type === "application/pdf";
  return (
    <>
      <PageHeader
        title={file.original_name}
        description={`${t("common.version")} ${file.version} · ${formatBytes(file.size_bytes)}`}
        back={{ href: back, label: t("common.back") }}
        actions={
          <LinkButton href={`/api/files/${file.id}`} variant="outline" size="sm">
            <Download className="h-4 w-4" aria-hidden="true" />
            {t("common.download")}
          </LinkButton>
        }
      />
      {isPdf && (
        <Card className="mb-6 overflow-hidden">
          <iframe src={`/api/files/${file.id}?inline=1`} title={file.original_name} className="h-[75vh] w-full bg-white" />
        </Card>
      )}
      {text === null ? (
        <Alert tone="warning">{t("submissions.previewUnavailable")}</Alert>
      ) : (
        <Card>
          <CardBody>
            <p className="mb-3 text-xs text-muted">{t("submissions.previewTruncated")}</p>
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words font-serif text-sm leading-relaxed text-foreground">{text}</pre>
            {truncated && <p className="mt-3 text-xs text-warning">…</p>}
          </CardBody>
        </Card>
      )}
    </>
  );
}
