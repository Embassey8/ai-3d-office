import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/** Format guard only (catches pasted garbage); the real check is asking Anthropic. */
export const AnthropicKeySchema = z
  .string()
  .trim()
  .min(30, "That is too short to be an Anthropic API key.")
  .max(300, "That is too long to be an Anthropic API key.")
  .regex(/^sk-ant-[A-Za-z0-9_-]+$/, 'Anthropic API keys start with "sk-ant-" and contain no spaces.');

export type KeyCheck =
  | { ok: true }
  | { ok: false; reason: "rejected" | "unreachable"; message: string };

/**
 * Verifies a key by listing models (no tokens are used). Never logs or echoes the key.
 * "rejected" = Anthropic said the key is invalid; "unreachable" = we could not tell (network, 5xx).
 */
export async function verifyAnthropicKey(key: string, timeoutMs = 10_000): Promise<KeyCheck> {
  try {
    const client = new Anthropic({ apiKey: key, maxRetries: 0, timeout: timeoutMs });
    await client.models.list({ limit: 1 });
    return { ok: true };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError)
      return { ok: false, reason: "rejected", message: "Anthropic rejected this key. Check that it is correct and active." };
    return { ok: false, reason: "unreachable", message: "Could not reach Anthropic to verify the key." };
  }
}
