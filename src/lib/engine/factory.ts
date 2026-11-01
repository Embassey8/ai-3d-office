import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getProvider, ProviderError } from "@/lib/ai";
import { requireAnthropicKey } from "./keys";
import type { EngineDeps } from "./runTask";
import { SupabaseStore } from "./supabaseStore";

/** Server-side configuration. None of these may ever be exposed to the browser. */
const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ANTHROPIC_API_KEY: z.string().min(10).optional(),
});

export interface EngineConfig {
  supabaseUrl: string;
  serviceRoleKey: string;
  anthropicApiKey?: string;
}

/** Returns the config, or a human-readable list of what is missing. */
export function readEngineConfig(env: Record<string, string | undefined> = process.env):
  | { ok: true; config: EngineConfig }
  | { ok: false; missing: string[] } {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) return { ok: false, missing: parsed.error.issues.map((i) => String(i.path[0])) };
  return {
    ok: true,
    config: {
      supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
      serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
      anthropicApiKey: parsed.data.ANTHROPIC_API_KEY,
    },
  };
}

export function createServiceClient(cfg: EngineConfig) {
  return createClient(cfg.supabaseUrl, cfg.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function createEngineDeps(cfg: EngineConfig, workerId: string): EngineDeps {
  const store = new SupabaseStore(createServiceClient(cfg));
  return {
    store,
    workerId,
    getProvider: async (name, ownerId) => {
      if (name !== "anthropic") throw new ProviderError(`The "${name}" provider is not implemented yet.`, "bad_request", false);
      const key = await requireAnthropicKey(store, ownerId, cfg.anthropicApiKey);
      return getProvider(name, { anthropicApiKey: key });
    },
  };
}
