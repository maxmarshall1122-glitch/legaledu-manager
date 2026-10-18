import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Translator } from "@/i18n";
import { buttonClass, cn } from "./ui";

/** Builds a query string, dropping empty values. */
export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** GET-form filter bar: works without JavaScript and keeps filters in the URL (shareable, back-button friendly). */
export function FilterBar({ t, children, resetHref }: { t: Translator; children: React.ReactNode; resetHref: string }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border p-4" role="search" aria-label={t("common.filters")}>
      {children}
      <div className="flex gap-2">
        <button type="submit" className={buttonClass("secondary", "md")}>
          {t("common.apply")}
        </button>
        <Link href={resetHref} className={buttonClass("ghost", "md")}>
          {t("common.clearFilters")}
        </Link>
      </div>
    </form>
  );
}

export function FilterField({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-40 flex-1 space-y-1 sm:flex-none", className)}>
      <label htmlFor={htmlFor} className="block text-xs font-medium text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

export function SortHeader({
  label,
  column,
  current,
  dir,
  base,
  params,
}: {
  label: string;
  column: string;
  current: string;
  dir: "asc" | "desc";
  base: string;
  params: Record<string, string | undefined>;
}) {
  const active = current === column;
  const nextDir = active && dir === "asc" ? "desc" : "asc";
  return (
    <Link
      href={`${base}${qs({ ...params, sort: column, dir: nextDir, page: undefined })}`}
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      {label}
      {active && (dir === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" />)}
    </Link>
  );
}

export function Pagination({
  t,
  page,
  pages,
  total,
  pageSize,
  base,
  params,
}: {
  t: Translator;
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  base: string;
  params: Record<string, string | undefined>;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted" aria-label={t("common.page", { page, pages })}>
      <span>{t("common.showing", { from, to, total })}</span>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link className={buttonClass("outline", "sm")} href={`${base}${qs({ ...params, page: page - 1 })}`}>
            {t("common.previous")}
          </Link>
        ) : (
          <span className={buttonClass("outline", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
            {t("common.previous")}
          </span>
        )}
        <span>{t("common.page", { page, pages })}</span>
        {page < pages ? (
          <Link className={buttonClass("outline", "sm")} href={`${base}${qs({ ...params, page: page + 1 })}`}>
            {t("common.next")}
          </Link>
        ) : (
          <span className={buttonClass("outline", "sm", "pointer-events-none opacity-50")} aria-disabled="true">
            {t("common.next")}
          </span>
        )}
      </div>
    </nav>
  );
}
