import { describe, expect, it } from "vitest";
import { sanitizeCell, toCsv } from "@/lib/csv";
import { exportCell } from "@/lib/report-format";
import { makeT } from "@/i18n";
import { buildReport, REPORT_TYPES } from "@/lib/services/reports";
import { globalSearch } from "@/lib/services/search";
import { listAssignments } from "@/lib/services/assignments";
import { listSubmissions } from "@/lib/services/submissions";
import { world } from "./helpers";

describe("CSV export", () => {
  it("neutralises spreadsheet formula injection", () => {
    for (const evil of ["=HYPERLINK(\"http://x\")", "+1+1", "-2+3", "@SUM(A1)", "\t=1", "\r=1"]) {
      expect(sanitizeCell(evil).startsWith("'")).toBe(true);
    }
    expect(sanitizeCell("Normal text")).toBe("Normal text");
    expect(sanitizeCell(-5)).toBe("-5"); // real numbers stay numeric
  });

  it("quotes, escapes, keeps missing values empty and adds a BOM for Excel", () => {
    const csv = toCsv(["Name", "Score"], [["Doe, \"J\"", 85], ["=cmd", null], ["Oʻzbek", 0]]);
    expect(csv).toBe('Name,Score\r\n"Doe, ""J""",85\r\n\'=cmd,\r\nOʻzbek,0\r\n');
    expect(toCsv(["a"], [], { excel: true }).charCodeAt(0)).toBe(0xfeff);
  });

  it("export cells distinguish missing (empty) from zero", () => {
    const t = makeT("en");
    expect(exportCell(t, { key: "final", kind: "number" }, null)).toBeNull();
    expect(exportCell(t, { key: "final", kind: "number" }, 0)).toBe(0);
    expect(exportCell(t, { key: "status", kind: "status" }, "revision_required")).toBe("Revision Required");
  });
});

describe("reports", () => {
  it("every report type builds from stored data", async () => {
    const w = await world();
    for (const type of REPORT_TYPES) {
      const r = await buildReport(w.lecturer, type, {}, "en");
      expect(r.rows.length, type).toBeGreaterThan(0);
      for (const row of r.rows) expect(row).toHaveLength(r.columns.length);
    }
  });

  it("grade summary shows missing final scores as null, not 0", async () => {
    const w = await world();
    const r = await buildReport(w.lecturer, "grades", {}, "en");
    const fi = r.columns.findIndex((c) => c.key === "final");
    const finals = r.rows.map((row) => row[fi]);
    expect(finals).toContain(null);
    expect(finals).toContain(85);
    expect(finals).not.toContain(0);
  });

  it("filters by status, group and subject", async () => {
    const w = await world();
    const outstanding = await buildReport(w.lecturer, "outstanding", {}, "en");
    const si = outstanding.columns.findIndex((c) => c.key === "status");
    expect(outstanding.rows.every((r) => r[si] === "assigned" || r[si] === "revision_required")).toBe(true);
    const law201 = (await w.repo.list("groups")).find((g) => g.name === "LAW-201")!;
    const reg = await buildReport(w.lecturer, "register", { group: law201.id }, "en");
    expect(reg.rows.every((r) => String(r[0]).startsWith("DEMO-23"))).toBe(true);
    const graded = await buildReport(w.lecturer, "status", { status: "graded" }, "en");
    expect(graded.rows.length).toBe((await w.repo.list("submissions", { eq: { status: "graded" } })).length);
  });

  it("subject report covers all six predefined subjects with null averages where nothing is graded", async () => {
    const w = await world();
    const r = await buildReport(w.lecturer, "subjects", {}, "en");
    expect(r.rows).toHaveLength(6);
    const avg = r.columns.findIndex((c) => c.key === "average");
    expect(r.rows.some((row) => row[avg] === null)).toBe(true);
  });
});

describe("global search and list filters", () => {
  it("staff search spans students, assignments, subjects and filenames", async () => {
    const w = await world();
    expect((await globalSearch(w.lecturer, "DEMO-24-0003"))!.students).toHaveLength(1);
    expect((await globalSearch(w.lecturer, "terminology"))!.assignments).toHaveLength(1);
    expect((await globalSearch(w.lecturer, "criminal"))!.subjects).toHaveLength(1);
    expect((await globalSearch(w.lecturer, "pptx"))!.files.length).toBeGreaterThan(0);
    expect(await globalSearch(w.lecturer, "a")).toBeNull();
  });

  it("student search never reveals other students or their files", async () => {
    const w = await world();
    const r = (await globalSearch(w.student1, "DEMO"))!;
    expect(r.students).toEqual([]);
    const files = (await globalSearch(w.student1, ".txt"))!.files;
    expect(files.every((f) => f.submission.student_id === w.student1.user.student_id)).toBe(true);
    expect((await globalSearch(w.student1, "Ehtiyotsizlik"))!.assignments).toEqual([]); // not their group
  });

  it("assignment and submission filters", async () => {
    const w = await world();
    const crim = (await w.repo.list("subjects")).find((s) => s.code === "CRIM")!;
    expect((await listAssignments(w.lecturer, { subject: crim.id })).every((a) => a.assignment.subject_id === crim.id)).toBe(true);
    expect((await listAssignments(w.lecturer, { status: "draft" })).length).toBe(1);
    const late = await listSubmissions(w.lecturer, { status: "revision_required" });
    expect(late.length).toBe(1);
    expect((await listSubmissions(w.lecturer, { q: "data_protection_essay" })).length).toBe(1);
  });
});
