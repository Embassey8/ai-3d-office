import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createEngineDeps, createServiceClient, readEngineConfig, type EngineConfig } from "@/lib/engine/factory";
import { createServerSupabase } from "@/lib/supabase/server";

/** The signed-in CEO for this request (verified with Supabase Auth), plus a client bound to their session (RLS applies). */
export async function requireUser() {
  const sb = await createServerSupabase();
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { sb, user: data.user };
}

/** Engine config, or a 503 response naming the missing variables (names only, never values). */
export function engineConfigOrResponse(opts: { needAnthropic: boolean }): { config: EngineConfig } | { response: NextResponse } {
  const r = readEngineConfig();
  const missing = r.ok ? [] : r.missing;
  if (r.ok && opts.needAnthropic && !r.config.anthropicApiKey) missing.push("ANTHROPIC_API_KEY");
  if (!r.ok || missing.length) {
    return {
      response: NextResponse.json(
        { error: `The AI engine is not configured on the server (missing: ${[...new Set(missing)].join(", ")}).`, code: "engine_not_configured" },
        { status: 503 },
      ),
    };
  }
  return { config: r.config };
}

export { createEngineDeps, createServiceClient };

export function secretMatches(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(`Bearer ${expected}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const tooMany = (retryAfterSec: number) =>
  NextResponse.json({ error: "Too many requests. Please slow down.", code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(retryAfterSec) } });
