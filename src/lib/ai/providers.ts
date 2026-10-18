import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { ApiError, FinishReason, GoogleGenAI } from "@google/genai";
import { aiConfig } from "@/lib/config";
import type { AiProviderId } from "@/lib/types";

export type AiErrorKind = "timeout" | "rateLimited" | "auth" | "refused" | "invalidOutput" | "noText" | "dailyLimit" | "generic";

export class AiError extends Error {
  constructor(public kind: AiErrorKind, detail?: string) {
    super(detail ?? kind);
    this.name = "AiError";
  }
}

export interface AiRequest {
  system: string;
  user: string;
  /** JSON Schema for the structured response. */
  schema: Record<string, unknown>;
}

export interface AiResponse {
  text: string;
  raw: unknown;
  model: string;
}

export interface AiProvider {
  id: AiProviderId;
  model: string;
  review(req: AiRequest): Promise<AiResponse>;
}

// Models that accept the server-side refusal fallback parameter.
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

class AnthropicProvider implements AiProvider {
  readonly id = "anthropic" as const;
  private client: Anthropic;
  constructor(
    apiKey: string,
    public model: string,
    private timeoutMs: number,
  ) {
    // Server-side only; the key never reaches the browser.
    this.client = new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 });
  }

  async review(req: AiRequest): Promise<AiResponse> {
    try {
      const useFallback = FALLBACK_MODELS.has(this.model);
      const msg = await this.client.beta.messages.create(
        {
          model: this.model,
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          output_config: { effort: "high", format: { type: "json_schema", schema: req.schema } },
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
        },
        { signal: AbortSignal.timeout(this.timeoutMs) },
      );
      if (msg.stop_reason === "refusal") throw new AiError("refused");
      if (msg.stop_reason === "max_tokens") throw new AiError("invalidOutput", "max_tokens");
      const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      return { text, raw: msg, model: msg.model };
    } catch (e) {
      throw mapAnthropicError(e);
    }
  }
}

function mapAnthropicError(e: unknown): AiError {
  if (e instanceof AiError) return e;
  if (e instanceof Anthropic.APIConnectionTimeoutError) return new AiError("timeout");
  if (e instanceof Anthropic.RateLimitError) return new AiError("rateLimited");
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return new AiError("auth");
  if (e instanceof Anthropic.APIUserAbortError || (e instanceof Error && e.name === "TimeoutError")) return new AiError("timeout");
  if (e instanceof Anthropic.APIError) return new AiError("generic", `anthropic status ${e.status}`);
  return new AiError("generic");
}

class GeminiProvider implements AiProvider {
  readonly id = "gemini" as const;
  private client: GoogleGenAI;
  constructor(
    apiKey: string,
    public model: string,
    private timeoutMs: number,
  ) {
    this.client = new GoogleGenAI({ apiKey, httpOptions: { timeout: timeoutMs } });
  }

  async review(req: AiRequest): Promise<AiResponse> {
    try {
      const res = await this.client.models.generateContent({
        model: this.model,
        contents: req.user,
        config: {
          systemInstruction: req.system,
          responseMimeType: "application/json",
          responseJsonSchema: req.schema,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });
      if (res.promptFeedback?.blockReason) throw new AiError("refused");
      const finish = res.candidates?.[0]?.finishReason;
      if (finish === FinishReason.SAFETY || finish === FinishReason.PROHIBITED_CONTENT) throw new AiError("refused");
      if (finish === FinishReason.MAX_TOKENS) throw new AiError("invalidOutput", "max_tokens");
      return { text: res.text ?? "", raw: res, model: res.modelVersion ?? this.model };
    } catch (e) {
      if (e instanceof AiError) throw e;
      if (e instanceof ApiError) {
        if (e.status === 429) throw new AiError("rateLimited");
        if (e.status === 401 || e.status === 403) throw new AiError("auth");
        if (e.status === 408 || e.status === 504) throw new AiError("timeout");
        throw new AiError("generic", `gemini status ${e.status}`);
      }
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) throw new AiError("timeout");
      throw new AiError("generic");
    }
  }
}

export function providerStatus(): Record<AiProviderId, { configured: boolean; model: string }> {
  const c = aiConfig();
  return {
    anthropic: { configured: c.anthropic.configured, model: c.anthropic.model },
    gemini: { configured: c.gemini.configured, model: c.gemini.model },
  };
}

/** Returns null when the provider has no server-side credentials configured. */
export function getProvider(id: AiProviderId): AiProvider | null {
  const c = aiConfig();
  if (id === "anthropic" && process.env.ANTHROPIC_API_KEY) return new AnthropicProvider(process.env.ANTHROPIC_API_KEY, c.anthropic.model, c.timeoutMs);
  if (id === "gemini" && process.env.GEMINI_API_KEY) return new GeminiProvider(process.env.GEMINI_API_KEY, c.gemini.model, c.timeoutMs);
  return null;
}
