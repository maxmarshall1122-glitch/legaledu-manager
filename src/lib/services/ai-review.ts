import { AppError, invalid } from "@/lib/errors";
import { extractText } from "@/lib/files/extract";
import type { AllowedExt } from "@/lib/files/validate";
import { AI_OUTPUT_JSON_SCHEMA, aiOutputSchema, buildSystemPrompt, buildUserPrompt } from "@/lib/ai/prompt";
import { AiError, type AiProvider } from "@/lib/ai/providers";
import { rateLimit } from "@/lib/rate-limit";
import { computeTotal } from "@/lib/rubric";
import type { AiProviderId, AiReviewResult, AiSuggestion } from "@/lib/types";
import { audit, mustGet, requireStaff, type Ctx } from "./core";

export interface AiDeps {
  getProvider: (id: AiProviderId) => AiProvider | null;
  dailyLimit: number;
  maxDocumentChars: number;
}

/**
 * AI-assisted review. Steps: authorize → load current-version files →
 * extract text → send minimum necessary content (no student identity) →
 * validate structured output → store as a *pending suggestion*, separate from
 * any instructor-approved review. Never assigns a grade.
 */
export async function requestAiReview(ctx: Ctx, submissionId: string, providerId: AiProviderId, deps: AiDeps): Promise<AiSuggestion> {
  requireStaff(ctx);
  if (providerId !== "anthropic" && providerId !== "gemini") throw invalid("validation.invalidSelection");
  const provider = deps.getProvider(providerId);
  if (!provider) throw invalid(`ai.providerUnavailable|${JSON.stringify({ provider: providerId === "anthropic" ? "Anthropic Claude" : "Google Gemini" })}`);

  const submission = await mustGet(ctx, "submissions", submissionId);
  const assignment = await mustGet(ctx, "assignments", submission.assignment_id);
  const criteria = await ctx.repo.list("rubric_criteria", { eq: { assignment_id: assignment.id }, order: { column: "position" } });
  if (criteria.length === 0) throw invalid("grading.noRubric");

  if (!rateLimit(`ai:${ctx.user.id}`, 5, 60_000).ok) throw new AppError("rate_limited", "ai.errors.rateLimited");
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const mine = await ctx.repo.list("ai_suggestions", { eq: { requested_by: ctx.user.id } });
  if (mine.filter((s) => s.created_at >= startOfDay.toISOString()).length >= deps.dailyLimit) {
    throw new AppError("rate_limited", "ai.errors.dailyLimit");
  }

  const files = await ctx.repo.list("submission_files", { eq: { submission_id: submission.id, version: submission.current_version } });
  const documents: { label: string; text: string }[] = [];
  for (const [i, f] of files.entries()) {
    const ext = f.storage_key.split(".").pop() as AllowedExt;
    try {
      const text = (await extractText(ext, await ctx.storage.get(f.storage_key))).trim();
      // File names can contain personal data, so documents are labelled generically.
      if (text) documents.push({ label: `Document ${i + 1} (${ext.toUpperCase()})`, text });
    } catch {
      /* unreadable file: skipped and reported via noText if nothing remains */
    }
  }
  if (documents.length === 0) throw invalid("ai.errors.noText");

  let budget = deps.maxDocumentChars;
  let truncatedAt: number | null = null;
  for (const d of documents) {
    if (d.text.length > budget) {
      d.text = d.text.slice(0, Math.max(0, budget));
      truncatedAt = deps.maxDocumentChars;
    }
    budget -= d.text.length;
  }

  const system = buildSystemPrompt(assignment.language);
  const user = buildUserPrompt(assignment, criteria, documents.filter((d) => d.text.length > 0));

  let response;
  try {
    response = await provider.review({ system, user, schema: AI_OUTPUT_JSON_SCHEMA as unknown as Record<string, unknown> });
  } catch (e) {
    const kind = e instanceof AiError ? e.kind : "generic";
    await audit(ctx, "ai.review_failed", "submissions", submission.id, { provider: providerId, kind });
    throw new AppError(kind === "rateLimited" ? "rate_limited" : "validation", `ai.errors.${kind}`);
  }

  const parsed = parseOutput(response.text, criteria, assignment.max_score);
  if (!parsed) {
    await audit(ctx, "ai.review_invalid", "submissions", submission.id, { provider: providerId, model: response.model });
    throw invalid("ai.errors.invalidOutput");
  }
  parsed.truncated_at = truncatedAt;

  const suggestion = await ctx.repo.insert("ai_suggestions", {
    submission_id: submission.id,
    version: submission.current_version,
    provider: providerId,
    model: response.model,
    status: "pending",
    raw_response: response.raw,
    parsed,
    error: null,
    requested_by: ctx.user.id,
    decided_by: null,
    decided_at: null,
  });
  await audit(ctx, "ai.review", "ai_suggestions", suggestion.id, { submission_id: submission.id, provider: providerId, model: response.model });
  return suggestion;
}

/** Strictly validates model output against the rubric; returns null if anything is off. */
export function parseOutput(
  text: string,
  criteria: { id: string; title: string; max_points: number; weight: number }[],
  maxScore: number,
): AiReviewResult | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const out = aiOutputSchema.safeParse(json);
  if (!out.success) return null;
  const ids = new Set(criteria.map((c) => c.id));
  const got = out.data.criteria;
  if (got.length !== criteria.length || new Set(got.map((c) => c.criterion_id)).size !== got.length) return null;
  if (!got.every((c) => ids.has(c.criterion_id))) return null;
  const scores = Object.fromEntries(got.map((c) => [c.criterion_id, c.suggested_score]));
  const { total, issues } = computeTotal(criteria, scores, maxScore);
  if (issues.length > 0 || total === null) return null;
  return { ...out.data, provisional_total: total };
}

export async function rejectAiSuggestion(ctx: Ctx, id: string) {
  requireStaff(ctx);
  const s = await mustGet(ctx, "ai_suggestions", id);
  await ctx.repo.update("ai_suggestions", id, { status: "rejected", decided_by: ctx.user.id, decided_at: new Date().toISOString() });
  await audit(ctx, "ai.reject", "ai_suggestions", id, { submission_id: s.submission_id });
}
