import type { Locale } from "@/lib/types";

export interface CriterionDef {
  id: string;
  title: string;
  max_points: number;
  weight: number;
}

export interface RubricIssue {
  criterion_id?: string;
  /** Translation key with optional params encoded as "key|{json}" */
  message: string;
}

export const DEFAULT_MAX_SCORE = 100;

/** Default rubric (25/20/20/15/10/10 = 100). Weight defaults to max points. */
export const DEFAULT_RUBRIC: { title: Record<Locale, string>; max_points: number }[] = [
  { title: { en: "Subject knowledge and accuracy", uz: "Fanni bilish va aniqlik" }, max_points: 25 },
  { title: { en: "Analysis and critical thinking", uz: "Tahlil va tanqidiy fikrlash" }, max_points: 20 },
  { title: { en: "Argumentation and application", uz: "Argumentatsiya va qoʻllash" }, max_points: 20 },
  { title: { en: "Evidence and citations", uz: "Dalillar va iqtiboslar" }, max_points: 15 },
  { title: { en: "Structure and presentation", uz: "Tuzilma va taqdimot" }, max_points: 10 },
  { title: { en: "Language and clarity", uz: "Til va ravshanlik" }, max_points: 10 },
];

export function defaultRubric(locale: Locale) {
  return DEFAULT_RUBRIC.map((c) => ({ title: c.title[locale], max_points: c.max_points, weight: c.max_points }));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Weighted total, scaled to the assignment maximum:
 *   total = maxScore × Σ(wᵢ · scoreᵢ / maxᵢ) / Σwᵢ
 * With the default rubric (wᵢ = maxᵢ, Σmaxᵢ = 100 = maxScore) this is simply Σscoreᵢ.
 */
export function computeTotal(
  criteria: CriterionDef[],
  scores: Record<string, number | null | undefined>,
  maxScore: number,
): { total: number | null; issues: RubricIssue[] } {
  const issues: RubricIssue[] = [];
  if (criteria.length === 0) return { total: null, issues: [{ message: "validation.atLeastOneCriterion" }] };
  if (!(maxScore > 0)) issues.push({ message: "validation.positive" });

  let weighted = 0;
  let weights = 0;
  for (const c of criteria) {
    if (!(c.max_points > 0) || !(c.weight > 0)) {
      issues.push({ criterion_id: c.id, message: "validation.positive" });
      continue;
    }
    const s = scores[c.id];
    if (s === null || s === undefined || Number.isNaN(s)) {
      issues.push({ criterion_id: c.id, message: "validation.required" });
      continue;
    }
    if (!Number.isFinite(s) || s < 0 || s > c.max_points) {
      issues.push({ criterion_id: c.id, message: `validation.scoreRange|${JSON.stringify({ max: c.max_points })}` });
      continue;
    }
    weighted += (c.weight * s) / c.max_points;
    weights += c.weight;
  }
  if (issues.length > 0) return { total: null, issues };
  const total = round2((maxScore * weighted) / weights);
  if (total > maxScore) {
    return { total: null, issues: [{ message: `validation.totalExceedsMax|${JSON.stringify({ max: maxScore })}` }] };
  }
  return { total, issues };
}

/** Validates a manually entered final score. */
export function validateFinalScore(score: number, maxScore: number): RubricIssue | null {
  if (!Number.isFinite(score) || score < 0) return { message: `validation.scoreRange|${JSON.stringify({ max: maxScore })}` };
  if (score > maxScore) return { message: `validation.totalExceedsMax|${JSON.stringify({ max: maxScore })}` };
  return null;
}
