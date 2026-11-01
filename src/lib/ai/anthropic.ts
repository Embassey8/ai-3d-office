import Anthropic from "@anthropic-ai/sdk";
import {
  ProviderError,
  type Block,
  type CompletionRequest,
  type CompletionResponse,
  type LLMProvider,
  type Message,
  type StopReason,
  type ToolSpec,
} from "./types";

export const PROVIDER_NAME = "anthropic";

/** Models whose API accepts `output_config.effort` (older ones error on it). */
const supportsEffort = (m: string) => /^claude-(opus-5|opus-4-[5-9]|sonnet-5|fable|mythos|haiku-5)/.test(m);
/** Models for which the refusal-fallback parameter is recommended and accepted. */
const supportsFallbacks = (m: string) => /^claude-(opus-5|sonnet-5-5|fable|mythos)/.test(m);

/* ---------- pure translation helpers (unit-tested) ---------- */

export function toAnthropicMessages(messages: Message[]): Anthropic.Beta.BetaMessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content.map((b): Anthropic.Beta.BetaContentBlockParam => {
      switch (b.type) {
        case "text":
          return { type: "text", text: b.text };
        case "tool_use":
          return { type: "tool_use", id: b.id, name: b.name, input: b.input };
        case "tool_result":
          return { type: "tool_result", tool_use_id: b.toolUseId, content: b.content, is_error: b.isError ?? false };
        case "opaque":
          // Echoed back exactly as received (thinking blocks must not be edited or dropped).
          return b.data as Anthropic.Beta.BetaContentBlockParam;
      }
    }),
  }));
}

export function toAnthropicTools(tools: ToolSpec[]): Anthropic.Beta.BetaToolUnion[] {
  return tools.map((t) =>
    t.kind === "function"
      ? ({ name: t.name, description: t.description, input_schema: t.inputSchema } as Anthropic.Beta.BetaTool)
      : (t.spec as unknown as Anthropic.Beta.BetaToolUnion),
  );
}

export function fromAnthropicContent(content: Anthropic.Beta.BetaContentBlock[]): Block[] {
  return content.map((b): Block => {
    if (b.type === "text") return { type: "text", text: b.text };
    if (b.type === "tool_use") return { type: "tool_use", id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> };
    return { type: "opaque", provider: PROVIDER_NAME, data: b };
  });
}

const STOP: Record<string, StopReason> = {
  end_turn: "end_turn", tool_use: "tool_use", max_tokens: "max_tokens", refusal: "refusal", pause_turn: "pause_turn",
};

export function toProviderError(e: unknown): ProviderError {
  if (e instanceof ProviderError) return e;
  if (e instanceof Anthropic.APIUserAbortError) return new ProviderError("Request aborted", "aborted", true);
  if (e instanceof Anthropic.RateLimitError) return new ProviderError(e.message, "rate_limit", true, e.status);
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
    return new ProviderError(`Anthropic rejected the API key or permissions: ${e.message}`, "auth", false, e.status);
  if (e instanceof Anthropic.BadRequestError || e instanceof Anthropic.NotFoundError || e instanceof Anthropic.UnprocessableEntityError)
    return new ProviderError(e.message, "bad_request", false, e.status);
  if (e instanceof Anthropic.APIConnectionError) return new ProviderError(e.message, "network", true);
  if (e instanceof Anthropic.APIError) {
    const retry = (e.status ?? 0) >= 500 || e.status === 408 || e.status === 409 || e.status === 529;
    return new ProviderError(e.message, retry ? "overloaded" : "unknown", retry, e.status);
  }
  return new ProviderError(e instanceof Error ? e.message : String(e), "unknown", false);
}

/* ---------- provider ---------- */

export class AnthropicProvider implements LLMProvider {
  readonly name = PROVIDER_NAME;
  private client: Anthropic;

  constructor(apiKey: string, opts: { maxRetries?: number; baseURL?: string } = {}) {
    this.client = new Anthropic({ apiKey, maxRetries: opts.maxRetries ?? 2, baseURL: opts.baseURL });
  }

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const base = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: toAnthropicMessages(req.messages),
      ...(req.tools.length ? { tools: toAnthropicTools(req.tools) } : {}),
      // Thinking is always on for these models; only the effort level is configurable.
      ...(supportsEffort(req.model) ? { output_config: { effort: "medium" as const } } : {}),
    };

    const run = (withFallback: boolean) => {
      const params = withFallback
        ? ({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming)
        : (base as unknown as Anthropic.Beta.MessageCreateParamsNonStreaming);
      // Streaming + finalMessage() avoids HTTP timeouts on long generations.
      return this.client.beta.messages.stream(params, { signal: req.signal }).finalMessage();
    };

    let msg: Anthropic.Beta.BetaMessage;
    try {
      const useFallback = supportsFallbacks(req.model);
      try {
        msg = await run(useFallback);
      } catch (e) {
        // If the API rejects the fallback parameter itself, retry once without it.
        if (useFallback && e instanceof Anthropic.BadRequestError && /fallback/i.test(e.message)) msg = await run(false);
        else throw e;
      }
    } catch (e) {
      throw toProviderError(e);
    }

    const u = msg.usage;
    return {
      content: fromAnthropicContent(msg.content),
      stopReason: STOP[msg.stop_reason ?? ""] ?? "other",
      usage: {
        inputTokens: u.input_tokens ?? 0,
        outputTokens: u.output_tokens ?? 0,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      },
      model: msg.model,
      stopDetail: (msg as { stop_details?: { category?: string | null; explanation?: string | null } | null }).stop_details?.explanation ?? undefined,
    };
  }
}
