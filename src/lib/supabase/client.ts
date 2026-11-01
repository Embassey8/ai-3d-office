import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** Browser client (anon key + the user's session; every query is subject to RLS). */
export function getBrowserClient(): SupabaseClient | null {
  const env = getSupabaseEnv();
  if (!env) return null;
  client ??= createBrowserClient(env.url, env.key);
  return client;
}
