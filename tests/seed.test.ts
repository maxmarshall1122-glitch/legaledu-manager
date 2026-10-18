import { describe, expect, it } from "vitest";
import { getDashboard } from "@/lib/services/dashboard";
import { world } from "./helpers";

describe("fictional demo seed", () => {
  it("builds a consistent dataset through the real services", async () => {
    const w = await world();
    expect(await w.repo.list("subjects")).toHaveLength(6);
    expect(await w.repo.list("students")).toHaveLength(12);
    const subs = await w.repo.list("submissions");
    expect(subs.length).toBeGreaterThanOrEqual(10);
    // every stored file exists in storage
    for (const f of await w.repo.list("submission_files")) expect(w.storage.files.has(f.storage_key)).toBe(true);
    // all students are clearly fictional records
    for (const s of await w.repo.list("students")) expect(s.notes).toMatch(/Fictional/);
  });

  it("dashboard figures are computed from records", async () => {
    const w = await world();
    const d = await getDashboard(w.lecturer, new Date("2026-10-18T10:00:00Z"));
    const subs = await w.repo.list("submissions");
    expect(d.totals.students).toBe(12);
    expect(d.totals.groups).toBe(3);
    expect(d.totals.submitted).toBe(subs.length);
    expect(d.totals.revision).toBe(subs.filter((s) => s.status === "revision_required").length);
    expect(d.statusChart.reduce((a, b) => a + b.count, 0)).toBe(subs.length);
    expect(d.totals.averagePercent).not.toBeNull();
  });
});
