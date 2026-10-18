export type Cell = string | number | boolean | null | undefined;

/**
 * Neutralises spreadsheet formula injection (CWE-1236): any text cell starting
 * with = + - @ TAB or CR is prefixed with an apostrophe so Excel / LibreOffice /
 * Google Sheets treat it as text. Real numbers are emitted as numbers.
 */
export function sanitizeCell(value: Cell): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return s;
}

function quote(s: string): string {
  return /[",\r\n;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * RFC 4180 CSV. `excel` adds a UTF-8 BOM so Excel detects Uzbek characters
 * (oʻ, gʻ, ʼ) correctly. Missing values are empty cells, never 0.
 */
export function toCsv(headers: string[], rows: Cell[][], opts: { excel?: boolean } = {}): string {
  const lines = [headers, ...rows].map((r) => r.map((c) => quote(sanitizeCell(c))).join(","));
  return (opts.excel ? "﻿" : "") + lines.join("\r\n") + "\r\n";
}
