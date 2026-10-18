import type { Locale } from "@/lib/types";

export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Asia/Tashkent";

const intlLocale = (l: Locale) => (l === "uz" ? "uz-Latn-UZ" : "en-GB");

export function formatDate(iso: string | null | undefined, locale: Locale, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(d);
}

export function formatNumber(n: number | null | undefined, locale: Locale, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: digits }).format(n);
}

export function formatBytes(n: number | null | undefined): string {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/** Value for <input type="datetime-local"> in the browser's local time. */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysUntil(iso: string, now = new Date()): number {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400_000);
}
