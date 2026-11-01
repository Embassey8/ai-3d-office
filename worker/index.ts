/**
 * Standalone background worker. Run it anywhere that can stay up (Railway, Fly.io, a VM, a container):
 *
 *   npm run worker
 *
 * Required env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional env: ANTHROPIC_API_KEY (fallback only: each CEO normally saves their own key in Settings)
 * Optional env: WORKER_POLL_MS (default 5000), WORKER_ID
 *
 * It polls the same queue as the web app's /api/worker/tick route. Claiming uses SELECT … FOR UPDATE
 * SKIP LOCKED, so any number of workers (and web triggers) can run concurrently without double-running a task.
 */
import { processQueue } from "../src/lib/engine/queue";
import { createEngineDeps, readEngineConfig } from "../src/lib/engine/factory";

const cfg = readEngineConfig();
if (!cfg.ok) {
  console.error(`[worker] missing or invalid environment variables: ${cfg.missing.join(", ")}`);
  process.exit(1);
}
if (!cfg.config.anthropicApiKey) {
  console.warn("[worker] no ANTHROPIC_API_KEY in the environment: using the keys CEOs saved in Settings (tasks for owners without a key will fail with a clear message)");
}

const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const pollMs = Math.max(1000, Number(process.env.WORKER_POLL_MS ?? 5000));
const deps = createEngineDeps(cfg.config, workerId);

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log(`[worker] ${sig} received, finishing current work…`);
    stopping = true;
  });
}

async function main() {
  console.log(`[worker] ${workerId} started, polling every ${pollMs}ms`);
  while (!stopping) {
    try {
      const results = await processQueue(deps, { maxTasks: 5, budgetMs: 120_000 });
      if (results.length) console.log(`[worker] ${new Date().toISOString()} ran ${results.length} task(s): ${results.map((r) => r.outcome).join(", ")}`);
    } catch (e) {
      console.error("[worker] tick failed:", e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
  console.log("[worker] stopped");
}

void main();
