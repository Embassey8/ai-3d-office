import { after, NextResponse } from "next/server";
import { processQueue } from "@/lib/engine/queue";
import { rateLimit } from "@/lib/server/rateLimit";
import { createEngineDeps, engineConfigOrResponse, requireUser, secretMatches, tooMany } from "@/lib/server/context";

/** Long enough for several tasks; Vercel enforces its own plan ceiling on top of this. */
export const maxDuration = 300;

/**
 * Runs queued tasks in the background (`after()`), responding immediately.
 *  - A signed-in CEO may trigger ONLY their own tasks.
 *  - A caller presenting `Authorization: Bearer $CRON_SECRET` (cron, external scheduler) processes every owner.
 * For always-on processing without callers, run the standalone worker (`npm run worker`).
 */
async function handle(req: Request) {
  let ownerId: string | undefined;
  if (secretMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    ownerId = undefined;
  } else {
    const auth = await requireUser();
    if (!auth) return NextResponse.json({ error: "Sign in first.", code: "unauthorized" }, { status: 401 });
    const limit = rateLimit(`tick:${auth.user.id}`, 10, 60_000);
    if (!limit.ok) return tooMany(limit.retryAfterSec);
    ownerId = auth.user.id;
  }

  // Without an API key tasks would just fail; leave them queued and say why.
  const cfg = engineConfigOrResponse({ needAnthropic: true });
  if ("response" in cfg) return cfg.response;

  const deps = createEngineDeps(cfg.config, `vercel-${Math.random().toString(36).slice(2, 8)}`);
  after(async () => {
    try {
      const results = await processQueue(deps, { ownerId, maxTasks: 5, budgetMs: (maxDuration - 45) * 1000 });
      console.log(`[worker] processed ${results.length} task(s):`, results.map((r) => r.outcome).join(", ") || "none");
    } catch (e) {
      console.error("[worker] queue processing failed:", e instanceof Error ? e.message : e);
    }
  });
  return NextResponse.json({ accepted: true }, { status: 202 });
}

export const POST = handle;
export const GET = handle;
