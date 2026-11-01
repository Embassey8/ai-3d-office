/**
 * Provider-neutral model interface. The engine only ever talks to `LLMProvider`; adapters translate
 * to and from a vendor SDK. Vendor-specific blocks that must be echoed back verbatim on the next
 * turn (e.g. Anthropic thinking / server-tool blocks) travel as `opaque` blocks.
 */
export type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; content: string; isError?: boolean }
  | { type: "opaque"; provider: string; data: unknown };

export interface Message {
  role: "user" | "assistant";
  content: Block[];
}

export type ToolSpec =
  | { kind: "function"; name: string; description: string; inputSchema: Record<string, unknown> }
  /** A tool the provider itself executes (e.g. Anthropic web search). */
  | { kind: "server"; provider: string; name: string; spec: Record<string, unknown> };

export type StopReason = "end_turn" | "tool_use" | "max_tokens" | "refusal" | "pause_turn" | "other";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface CompletionRequest {
  model: string;
  system: string;
  messages: Message[];
  tools: ToolSpec[];
  maxTokens: number;
  signal?: AbortSignal;
}

export interface CompletionResponse {
  content: Block[];
  stopReason: StopReason;
  usage: Usage;
  /** The model that actually served the request (may differ if a fallback ran). */
  model: string;
  stopDetail?: string;
}

export interface LLMProvider {
  readonly name: string;
  complete(req: CompletionRequest): Promise<CompletionResponse>;
}

export type ProviderErrorKind = "rate_limit" | "overloaded" | "network" | "auth" | "bad_request" | "aborted" | "unknown";

/** Normalised failure. `retryable` drives the engine's retry/backoff decision. */
export class ProviderError extends Error {
  constructor(
    message: string,
    readonly kind: ProviderErrorKind,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export const textOf = (blocks: Block[]) =>
  blocks.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 });
