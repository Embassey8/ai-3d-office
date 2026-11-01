import { AnthropicProvider } from "./anthropic";
import { ProviderError, type LLMProvider } from "./types";

export * from "./types";
export { estimateCostUsd } from "./pricing";

/** Default for new employees and for the engine when a record has no model. */
export const DEFAULT_MODEL = "claude-opus-5-5";

export interface ProviderConfig {
  anthropicApiKey?: string;
}

/** Resolves an employee's configured provider. Only Anthropic is implemented today. */
export function getProvider(name: string, cfg: ProviderConfig): LLMProvider {
  if (name === "anthropic") {
    if (!cfg.anthropicApiKey) throw new ProviderError("ANTHROPIC_API_KEY is not configured on the server.", "auth", false);
    return new AnthropicProvider(cfg.anthropicApiKey);
  }
  throw new ProviderError(`The "${name}" provider is not implemented yet.`, "bad_request", false);
}
