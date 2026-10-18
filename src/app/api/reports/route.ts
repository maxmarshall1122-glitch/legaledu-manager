import { NextResponse } from "next/server";
import { getCtx } from "@/lib/auth/server";
import { toCsv } from "@/lib/csv";
import { rateLimit } from "@/lib/rate-limit";
import { exportCell } from "@/lib/report-format";
import { audit, isStaff } from "@/lib/services/core";
import { buildReport, REPORT_TYPES, type ReportType } from "@/lib/services/reports";
import { makeT } from "@/i18n";

export const dynamic = "force-dynamic";

/** Authorized CSV export (staff only) with formula-injection protection. `format=excel` adds a UTF-8 BOM. */
export async function GET(req: Request) {
  const ctx = await getCtx();
  if (!ctx) return new NextResponse("Unauthorized", { status: 401 });
  if (!isStaff(ctx.user)) return new NextResponse("Forbidden", { status: 403 });
  if (!rateLimit(`export:${ctx.user.id}`, 30, 60_000).ok) return new NextResponse("Too many requests", { status: 429 });
  const sp = new URL(req.url).searchParams;
  const type = sp.get("type") as ReportType;
  if (!REPORT_TYPES.includes(type)) return new NextResponse("Bad request", { status: 400 });
  const filters = {
    subject: sp.get("subject") || undefined,
    group: sp.get("group") || undefined,
    assignment: sp.get("assignment") || undefined,
    status: sp.get("status") || undefined,
    from: sp.get("from") || undefined,
    to: sp.get("to") || undefined,
  };
  const t = makeT(ctx.locale);
  const report = await buildReport(ctx, type, filters, ctx.locale);
  const csv = toCsv(
    report.columns.map((c) => t(`reports.columns.${c.key as "studentCode"}`)),
    report.rows.map((r) => r.map((v, i) => exportCell(t, report.columns[i], v))),
    { excel: sp.get("format") === "excel" },
  );
  await audit(ctx, "report.export", "reports", null, { type, filters, rows: report.rows.length });
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="legaledu-${type}-${stamp}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
