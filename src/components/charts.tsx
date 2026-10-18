"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "./i18n-provider";

// Colors come from CSS tokens (validated categorical slots; dark values are stepped separately).
const SERIES_1 = "var(--chart-1)";
const SERIES_2 = "var(--chart-2)";
const AXIS = { fontSize: 12, fill: "var(--muted)" };

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-foreground">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <span className="text-muted">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

function DataTable({ caption, headers, rows }: { caption: string; headers: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-xs text-muted hover:text-foreground">{caption}</summary>
      <table className="mt-2 w-full text-left text-xs">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} scope="col" className="border-b border-border py-1 pr-3 font-semibold text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j} className="border-b border-border py-1 pr-3 tabular-nums text-foreground">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Single series → one hue, no legend box (the card title names it). */
export function StatusChart({ data }: { data: { label: string; count: number }[] }) {
  const { t } = useI18n();
  const total = data.reduce((a, b) => a + b.count, 0);
  if (total === 0) return <p className="py-10 text-center text-sm text-muted">{t("dashboard.chartEmpty")}</p>;
  return (
    <figure>
      <div className="h-64" role="img" aria-label={`${t("dashboard.submissionStatusChart")}: ${data.map((d) => `${d.label} ${d.count}`).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28, top: 4, bottom: 4 }} barCategoryGap={6}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={130} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--surface-muted)" }} content={<ChartTooltip />} />
            <Bar dataKey="count" name={t("common.total")} fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={18} label={{ position: "right", fontSize: 12, fill: "var(--foreground)" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption={t("common.details")} headers={[t("common.status"), t("common.total")]} rows={data.map((d) => [d.label, d.count])} />
    </figure>
  );
}

/** Two series of the same unit (counts) on one axis; legend present, no dual axis. */
export function WorkloadChart({ data }: { data: { label: string; assignments: number; submissions: number }[] }) {
  const { t } = useI18n();
  if (data.every((d) => d.assignments === 0 && d.submissions === 0)) {
    return <p className="py-10 text-center text-sm text-muted">{t("dashboard.chartEmpty")}</p>;
  }
  return (
    <figure>
      <div className="h-72" role="img" aria-label={t("dashboard.workloadChart")}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }} barGap={2} barCategoryGap={10}>
            <CartesianGrid horizontal={false} stroke="var(--border)" strokeDasharray="2 4" />
            <XAxis type="number" allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={150} tick={AXIS} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: "var(--surface-muted)" }} content={<ChartTooltip />} />
            <Legend
              verticalAlign="top"
              align="left"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
              formatter={(value: string) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
            />
            <Bar dataKey="assignments" name={t("dashboard.workloadAssignments")} fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={12} />
            <Bar dataKey="submissions" name={t("dashboard.workloadSubmissions")} fill={SERIES_2} radius={[0, 4, 4, 0]} maxBarSize={12} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption={t("common.details")}
        headers={[t("subjects.title"), t("dashboard.workloadAssignments"), t("dashboard.workloadSubmissions")]}
        rows={data.map((d) => [d.label, d.assignments, d.submissions])}
      />
    </figure>
  );
}

/** A part-of-whole with two parts reads best as a labelled meter, not a pie. */
export function ProgressMeter({ graded, total }: { graded: number; total: number }) {
  const { t } = useI18n();
  if (total === 0) return <p className="py-10 text-center text-sm text-muted">{t("dashboard.chartEmpty")}</p>;
  const pct = Math.round((graded / total) * 100);
  return (
    <div>
      <p className="text-3xl font-semibold tabular-nums text-foreground">{pct}%</p>
      <p className="text-sm text-muted">
        {graded} / {total} · {t("dashboard.graded")}
      </p>
      <div
        className="mt-4 flex h-3 w-full gap-0.5 overflow-hidden rounded-full"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={graded}
        aria-label={t("dashboard.gradingProgressChart")}
      >
        {graded > 0 && <div className="h-full rounded-full" style={{ width: `${pct}%`, background: SERIES_1 }} title={`${t("dashboard.graded")}: ${graded}`} />}
        {graded < total && <div className="h-full flex-1 rounded-full" style={{ background: "var(--chart-track)" }} title={`${t("dashboard.ungraded")}: ${total - graded}`} />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: SERIES_1 }} aria-hidden="true" />
            {t("dashboard.graded")}
          </dt>
          <dd className="font-semibold tabular-nums text-foreground">{graded}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--chart-track)" }} aria-hidden="true" />
            {t("dashboard.ungraded")}
          </dt>
          <dd className="font-semibold tabular-nums text-foreground">{total - graded}</dd>
        </div>
      </dl>
    </div>
  );
}
