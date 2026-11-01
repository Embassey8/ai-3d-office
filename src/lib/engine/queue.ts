import { runTask, type EngineDeps, type TaskOutcome } from "./runTask";

export interface QueueResult {
  taskId: string;
  outcome: TaskOutcome;
}

/**
 * Turns decided approvals into task state: approved -> back on the queue (the same tool call is
 * then allowed exactly once), rejected/expired -> task failed.
 */
export async function resumeDecidedApprovals(deps: EngineDeps, ownerId?: string): Promise<number> {
  const { store } = deps;
  let changed = 0;
  for (const { task, approvals } of await store.listWaitingTasks(ownerId)) {
    if (approvals.some((a) => a.status === "pending")) continue;
    const last = approvals[approvals.length - 1];
    if (!last) continue;
    if (last.status === "approved") {
      await store.updateTask(task.id, { status: "queued", attempts: Math.max(0, task.attempts - 1), error: null });
      await store.updateEmployee(task.employeeId, { status: "idle", currentTaskId: null });
      await store.log({ ownerId: task.ownerId, employeeId: task.employeeId, taskId: task.id, eventType: "approval.approved", message: `CEO approved: ${last.description}. Task re-queued.` });
    } else {
      const why = last.status === "rejected" ? `The CEO rejected: ${last.description}${last.decisionNote ? ` (${last.decisionNote})` : ""}` : `Approval ${last.status}: ${last.description}`;
      await store.updateTask(task.id, { status: "failed", error: why, lockedBy: null, finished: true });
      await store.updateEmployee(task.employeeId, { status: "idle", currentTaskId: null });
      await store.log({ ownerId: task.ownerId, employeeId: task.employeeId, taskId: task.id, eventType: "approval.rejected", message: why, level: "warn" });
      await store.notify({ ownerId: task.ownerId, type: "task_failed", title: "Task stopped: approval not granted", body: why, employeeId: task.employeeId, taskId: task.id });
    }
    changed++;
  }
  return changed;
}

/** Claims and runs queued tasks until the queue is empty, `maxTasks` is reached or the time budget is spent. */
export async function processQueue(
  deps: EngineDeps,
  opts: { ownerId?: string; maxTasks?: number; budgetMs?: number } = {},
): Promise<QueueResult[]> {
  const started = Date.now();
  const results: QueueResult[] = [];
  await deps.store.requeueStale();
  await resumeDecidedApprovals(deps, opts.ownerId);
  while (results.length < (opts.maxTasks ?? 5) && Date.now() - started < (opts.budgetMs ?? 240_000)) {
    const task = await deps.store.claimNextTask(deps.workerId, opts.ownerId);
    if (!task) break;
    results.push({ taskId: task.id, outcome: await runTask(deps, task) });
  }
  return results;
}
