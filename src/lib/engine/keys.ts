import { ProviderError } from "@/lib/ai";
import type { Store } from "./store";

export const MISSING_KEY_MESSAGE = "No Anthropic API key is configured. Add one in Settings → API keys.";

/** The CEO's own key (Settings) wins; a server-level env key is only a fallback. */
export async function resolveAnthropicKey(store: Pick<Store, "getSecret">, ownerId: string, envKey?: string): Promise<string | null> {
  return (await store.getSecret(ownerId, "anthropic_api_key")) ?? (envKey && envKey.length > 0 ? envKey : null);
}

export async function requireAnthropicKey(store: Pick<Store, "getSecret">, ownerId: string, envKey?: string): Promise<string> {
  const key = await resolveAnthropicKey(store, ownerId, envKey);
  if (!key) throw new ProviderError(MISSING_KEY_MESSAGE, "auth", false);
  return key;
}
