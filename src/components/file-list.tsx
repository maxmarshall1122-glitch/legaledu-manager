import { Download, Eye, FileText } from "lucide-react";
import type { Translator } from "@/i18n";
import { formatBytes, formatDate } from "@/lib/format";
import type { Locale, SubmissionFile } from "@/lib/types";

/** Files of one submission version, with access-controlled preview and download links. */
export function FileList({ t, locale, files, previewBase }: { t: Translator; locale: Locale; files: SubmissionFile[]; previewBase: string }) {
  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {files.map((f) => (
        <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="flex min-w-0 items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{f.original_name}</span>
              <span className="block text-xs text-muted">
                {formatBytes(f.size_bytes)} · {formatDate(f.created_at, locale, true)}
              </span>
            </span>
          </span>
          <span className="flex gap-3">
            <a href={`${previewBase}/${f.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Eye className="h-4 w-4" aria-hidden="true" />
              {t("common.preview")}
            </a>
            <a href={`/api/files/${f.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
              <Download className="h-4 w-4" aria-hidden="true" />
              {t("common.download")}
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
