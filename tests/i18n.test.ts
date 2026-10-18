import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { dictionaries, interpolate, lookup, makeT, translateMessage } from "@/i18n";
import en from "@/i18n/en";
import uz from "@/i18n/uz";
import { ASSIGNMENT_TEMPLATES, FEEDBACK_TEMPLATES } from "@/i18n/templates";
import { ASSIGNMENT_STATUSES, ASSIGNMENT_TYPES, ENROLLMENT_STATUSES, WORK_STATUSES } from "@/lib/types";

function flatten(o: object, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "string") out[prefix + k] = v;
    else Object.assign(out, flatten(v, `${prefix}${k}.`));
  }
  return out;
}

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

const EN = flatten(en);
const UZ = flatten(uz);

describe("Uzbek / English localization", () => {
  it("both languages define exactly the same keys, none empty", () => {
    expect(Object.keys(UZ).sort()).toEqual(Object.keys(EN).sort());
    for (const [k, v] of Object.entries({ ...EN, ...UZ })) expect(v.trim(), k).not.toBe("");
  });

  it("placeholders match between languages", () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(EN)) expect(ph(UZ[k]), k).toBe(ph(EN[k]));
  });

  it("Uzbek strings are actually translated (not copied English) for user-facing labels", () => {
    const same = Object.keys(EN).filter((k) => EN[k] === UZ[k] && EN[k].length > 3 && !/^[A-Z\d\s—–\-.,:%{}/()]+$/.test(EN[k]));
    // Allowed identical: product name, language self-names, technical acronyms
    expect(same.filter((k) => !["app.name", "common.uzbek", "common.english", "roles.admin", "reports.columns.minimum", "students.academicYearHint"].includes(k))).toEqual([]);
  });

  it("every status, type and enum value has a label in both languages", () => {
    for (const d of Object.values(dictionaries)) {
      for (const s of WORK_STATUSES) expect(lookup(d, `workStatus.${s}`)).toBeTruthy();
      for (const s of ASSIGNMENT_TYPES) expect(lookup(d, `assignmentType.${s}`)).toBeTruthy();
      for (const s of ASSIGNMENT_STATUSES) expect(lookup(d, `assignmentStatus.${s}`)).toBeTruthy();
      for (const s of ENROLLMENT_STATUSES) expect(lookup(d, `enrollment.${s}`)).toBeTruthy();
    }
  });

  it("every literal translation key used in the source exists (no missing strings)", () => {
    const files = walk(path.resolve("src")).filter((f) => /\.(ts|tsx)$/.test(f));
    const keys = new Set<string>();
    for (const f of files) {
      const src = fs.readFileSync(f, "utf8");
      for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z]+\.[a-zA-Z0-9_.]+)"/g)) keys.add(m[1]);
      // Validation/error keys anywhere; other namespaces when passed as user-facing messages.
      for (const m of src.matchAll(/"((?:validation|errors)\.[a-zA-Z0-9_.]+)"/g)) keys.add(m[1]);
      for (const m of src.matchAll(/(?:invalid\(|message: |error: |success: |messageKey === )[`"]([a-z]+\.[a-zA-Z0-9.]+)[|`"]/g)) keys.add(m[1]);
    }
    const missing = [...keys].filter((k) => lookup(en, k) === undefined && !k.endsWith("."));
    expect(missing).toEqual([]);
    expect(keys.size).toBeGreaterThan(200);
  });

  it("translates with interpolation and falls back safely", () => {
    expect(makeT("uz")("common.daysLeft", { n: 3 })).toBe("3 kun qoldi");
    expect(makeT("en")("common.daysLeft", { n: 3 })).toBe("3 days left");
    expect(interpolate("{a} and {b}", { a: 1 })).toBe("1 and {b}");
    const t = makeT("uz");
    expect(translateMessage(t, 'validation.scoreRange|{"max":25}')).toBe("Ball 0 dan 25 gacha boʻlishi kerak.");
    expect(translateMessage(t, "some raw text")).toBe("some raw text");
  });

  it("assignment and feedback templates exist in both languages", () => {
    for (const tpl of ASSIGNMENT_TEMPLATES) for (const l of ["uz", "en"] as const) expect(tpl.instructions[l].length).toBeGreaterThan(20);
    for (const tpl of FEEDBACK_TEMPLATES) for (const l of ["uz", "en"] as const) expect(tpl.text[l].length).toBeGreaterThan(10);
  });
});
