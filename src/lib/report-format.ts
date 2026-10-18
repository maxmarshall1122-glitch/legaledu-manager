import type { Translator } from "@/i18n";
import { formatDate, formatNumber } from "@/lib/format";
import type { ReportColumn, ReportValue } from "@/lib/services/reports";
import type { Locale } from "@/lib/types";

/** On-screen cell text. Missing data (null) is shown as "—", never as 0. */
export function displayCell(t: Translator, locale: Locale, col: ReportColumn, v: ReportValue): string {
  if (v === null || v === undefined || v === "") return t("common.missing");
  switch (col.kind) {
    case "date":
      return formatDate(String(v), locale, true);
    case "status":
      return t(`workStatus.${v as "assigned"}`);
    case "bool":
      return v ? t("common.yes") : t("common.no");
    case "number":
      return formatNumber(Number(v), locale, 2);
    default:
      return String(v);
  }
}

/** Export cell value. Missing data stays empty (not 0); numbers stay numeric. */
export function exportCell(t: Translator, col: ReportColumn, v: ReportValue): string | number | null {
  if (v === null || v === undefined || v === "") return null;
  switch (col.kind) {
    case "date": {
      const d = new Date(String(v));
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 16).replace("T", " ");
    }
    case "status":
      return t(`workStatus.${v as "assigned"}`);
    case "bool":
      return v ? t("common.yes") : t("common.no");
    case "number":
      return Number(v);
    default:
      return String(v);
  }
}
