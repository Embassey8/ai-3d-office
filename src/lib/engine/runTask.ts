import {
  ProviderError, emptyUsage, estimateCostUsd, textOf,
  type Block, type LLMProvider, type Message, type Usage,
} from "@/lib/ai";
import { buildSystemPrompt, buildTaskPrompt } from "./prompt";
import type { LogLevel, Store, TaskRecord } from "./store";
import { hashToolCall, resolveTools, type ToolContext } from "./tools";

export interface EngineDeps {
  store: Store;
  getProvider: (name: string) => LLMProvider;
  workerId: string;
  now?: () => Date;
  maxSteps?: number;
  maxTokens?: number;
  /** Delay before retry number `attempt` (1-based). */
  backoffMs?: (attempt: number) => number;
}

export type TaskOutcome = "completed" | "failed" | "retry" | "waiting" | "stopped";

const DEFAULT_MAX_STEPS = 10;
const DEFAULT_MAX_TOKENS = 16000;
export const defaultBackoffMs = (attempt: number) => Math.min(60_000 * 2 ** (attempt - 1), 15 * 60_000);

/**
 * Executes one claimed task end to end. Every state change is persisted as it happens (the 3D
 * office reads it via Realtime), and every step is written to activity_logs. This function never
 * throws for task-level problems: they become `failed` / `retry` outcomes.
 */
export async function runTask(deps: EngineDeps, task: TaskRecord): Promise<TaskOutcome> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const maxSteps = deps.maxSteps ?? DEFAULT_MAX_STEPS;
  let execId: string | undefined;
  const usage: Usage = emptyUsage();
  let costUsd = 0;
  let unpriced = false;

  const log = (eventType: string, message: string, level: LogLevel = "info", metadata?: Record<string, unknown>) =>
    store.log({ ownerId: task.ownerId, employeeId: task.employeeId, taskId: task.id, executionId: execId, eventType, level, message, metadata });
  const addUsage = (model: string, u: Usage) => {
    usage.inputTokens += u.inputTokens; usage.outputTokens += u.outputTokens;
    usage.cacheReadTokens += u.cacheReadTokens; usage.cacheWriteTokens += u.cacheWriteTokens;
    const c = estimateCostUsd(model, u);
    if (c === null) unpriced = true; else costUsd += c;
  };
  const tokenPatch = () => ({ inputTokens: usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens, outputTokens: usage.outputTokens, costUsd });

  const employee = await store.getEmployee(task.employeeId);
  if (!employee) {
    await store.updateTask(task.id, { status: "failed", error: "The assigned employee no longer exists.", lockedBy: null, finished: true });
    await log("task.failed", "The assigned employee no longer exists.", "error");
    return "failed";
  }

  /** Updates the employee's status/current task, but never overwrites a CEO-imposed pause. */
  const setEmployee = async (status: Parameters<Store["updateEmployee"]>[1]["status"], clearTask = false, currentTaskId?: string) => {
    const current = await store.getEmployee(employee.id);
    const patch: Parameters<Store["updateEmployee"]>[1] = {};
    if (current?.status !== "paused") patch.status = status;
    if (clearTask) patch.currentTaskId = null;
    else if (currentTaskId !== undefined) patch.currentTaskId = currentTaskId;
    await store.updateEmployee(employee.id, patch);
  };

  const fail = async (message: string, o: { retryable: boolean; execStatus?: "failed" | "timed_out" }): Promise<TaskOutcome> => {
    if (execId) await store.finishExecution(execId, { status: o.execStatus ?? "failed", error: message, ...tokenPatch(), finished: true });
    if (o.retryable && task.attempts < task.maxAttempts) {
      const delay = (deps.backoffMs ?? defaultBackoffMs)(task.attempts);
      await store.updateTask(task.id, { status: "queued", error: message, lockedBy: null, runAfter: new Date(now().getTime() + delay) });
      await setEmployee("idle", true);
      await log("task.retry", `Attempt ${task.attempts}/${task.maxAttempts} failed: ${message}. Retrying in ${Math.round(delay / 1000)}s.`, "warn");
      return "retry";
    }
    await store.updateTask(task.id, { status: "failed", error: message, lockedBy: null, finished: true });
    await setEmployee("error", true);
    await log("task.failed", message, "error");
    await store.notify({ ownerId: task.ownerId, type: "task_failed", title: `${employee.name} could not finish "${task.title}"`, body: message, employeeId: employee.id, taskId: task.id });
    return "failed";
  };

  const timeoutMs = task.timeoutSeconds * 1000;
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

  try {
    // ---- setup -------------------------------------------------------------------------------
    let provider: LLMProvider;
    try {
      provider = deps.getProvider(employee.modelProvider);
    } catch (e) {
      const pe = e instanceof ProviderError ? e : new ProviderError(String(e), "unknown", false);
      return await fail(pe.message, { retryable: pe.retryable });
    }

    const [grants, memories] = await Promise.all([store.listGrantedTools(employee.id), store.listMemories(employee.id, 12)]);
    const { defs, specs, unavailable } = resolveTools(grants);
    const exec = await store.startExecution({
      ownerId: task.ownerId, taskId: task.id, employeeId: employee.id, workerId: deps.workerId,
      provider: employee.modelProvider, model: employee.modelName,
    });
    execId = exec.id;
    await setEmployee("thinking", false, task.id);
    await log("task.started", `Started "${task.title}" (attempt ${exec.attempt}) on ${employee.modelName}.`, "info", {
      tools: specs.map((s) => s.name), unavailableTools: unavailable.map((t) => t.slug), memories: memories.length,
    });

    const system = buildSystemPrompt({ employee, memories, unavailable, mode: "task", now: now() });
    const messages: Message[] = [{ role: "user", content: [{ type: "text", text: buildTaskPrompt(task) }] }];
    const ctx: ToolContext = { store, employee, task, counters: { memories: 0, delegations: 0 } };

    // ---- agent loop --------------------------------------------------------------------------
    for (let step = 1; step <= maxSteps; step++) {
      // Honour pause / cancel requested by the CEO while we were working.
      const fresh = await store.getTask(task.id);
      if (!fresh || fresh.status === "cancelled" || fresh.status === "paused") {
        await store.finishExecution(execId, { status: "cancelled", error: `Stopped: task was ${fresh?.status ?? "deleted"} by the CEO.`, ...tokenPatch(), finished: true });
        if (fresh) await store.updateTask(task.id, { lockedBy: null });
        await setEmployee("idle", true);
        await log("task.stopped", `Task was ${fresh?.status ?? "deleted"}; stopped before step ${step}.`, "warn");
        return "stopped";
      }

      await setEmployee("thinking");
      let resp;
      try {
        resp = await provider.complete({ model: employee.modelName, system, messages, tools: specs, maxTokens: deps.maxTokens ?? DEFAULT_MAX_TOKENS, signal: controller.signal });
      } catch (e) {
        if (timedOut) return await fail(`Timed out after ${task.timeoutSeconds}s.`, { retryable: true, execStatus: "timed_out" });
        const pe = e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : String(e), "unknown", false);
        return await fail(pe.message, { retryable: pe.retryable });
      }
      addUsage(resp.model, resp.usage);
      await log("model.response", `Step ${step}: ${resp.stopReason} (${resp.usage.inputTokens} in / ${resp.usage.outputTokens} out tokens).`, "debug", {
        model: resp.model, stopReason: resp.stopReason,
      });
      messages.push({ role: "assistant", content: resp.content });

      if (resp.stopReason === "refusal")
        return await fail(`The model declined to continue${resp.stopDetail ? `: ${resp.stopDetail}` : "."}`, { retryable: false });
      if (resp.stopReason === "max_tokens")
        return await fail("The model's response hit the output token limit.", { retryable: false });
      if (resp.stopReason === "pause_turn") continue;

      if (resp.stopReason === "tool_use") {
        const calls = resp.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
        if (calls.length === 0) return await fail("The model requested a tool call without any tool_use block.", { retryable: false });
        const results: Block[] = [];
        for (const call of calls) {
          const def = defs.get(call.name);
          if (!def) {
            await log("tool.denied", `Tool "${call.name}" is not available to ${employee.name}.`, "warn", { tool: call.name });
            results.push({ type: "tool_result", toolUseId: call.id, content: `Tool "${call.name}" is not available to you.`, isError: true });
            continue;
          }
          const parsed = def.schema.safeParse(call.input);
          if (!parsed.success) {
            await log("tool.invalid", `Invalid input for ${call.name}: ${parsed.error.issues[0]?.message}`, "warn", { tool: call.name });
            results.push({ type: "tool_result", toolUseId: call.id, content: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true });
            continue;
          }
          const input = parsed.data;

          if (def.approval) {
            const inputHash = hashToolCall(def.spec.name, input);
            const approved = await store.findApprovedApproval(task.id, def.grant, inputHash);
            if (!approved) {
              const description = def.approval.describe(input);
              const approvalId = await store.createApproval({
                ownerId: task.ownerId, employeeId: employee.id, taskId: task.id, executionId: execId,
                actionType: def.approval.actionType, description,
                payload: { tool: def.spec.name, grant: def.grant, inputHash, input },
              });
              await store.finishExecution(execId, { status: "waiting_for_approval", output: `Waiting for CEO approval: ${description}`, ...tokenPatch(), finished: true });
              await store.updateTask(task.id, { status: "waiting_for_approval", lockedBy: null });
              await setEmployee("waiting_for_approval");
              await log("approval.requested", `Waiting for CEO approval: ${description}`, "info", { approvalId, tool: def.spec.name });
              await store.notify({ ownerId: task.ownerId, type: "approval_requested", title: `${employee.name} needs your approval`, body: description, employeeId: employee.id, taskId: task.id, approvalId });
              return "waiting";
            }
            await store.consumeApproval(approved.id);
            await log("approval.consumed", `Approved action executed: ${def.approval.describe(input)}`, "info", { approvalId: approved.id });
          }

          await setEmployee("working");
          await log("tool.called", `Calling ${call.name}.`, "info", { tool: call.name });
          let result;
          try {
            result = await def.execute(ctx, input);
          } catch (e) {
            result = { content: `Tool failed: ${e instanceof Error ? e.message : String(e)}`, isError: true };
          }
          await log("tool.result", `${call.name} ${result.isError ? "returned an error" : "succeeded"}: ${result.content.slice(0, 300)}`, result.isError ? "warn" : "info", { tool: call.name });
          results.push({ type: "tool_result", toolUseId: call.id, content: result.content, isError: result.isError });
        }
        messages.push({ role: "user", content: results });
        continue;
      }

      if (resp.stopReason === "end_turn") {
        const text = textOf(resp.content);
        if (!text) return await fail("The model finished without producing a result.", { retryable: false });
        await store.finishExecution(execId, { status: "succeeded", output: text, ...tokenPatch(), finished: true });
        await store.updateTask(task.id, { status: "completed", result: text, error: null, lockedBy: null, finished: true });
        await setEmployee("completed", true);
        await log("task.completed", `Completed "${task.title}".`, "info", { costUsd, costIsEstimate: true, unpricedModel: unpriced });
        await store.notify({ ownerId: task.ownerId, type: "task_completed", title: `${employee.name} finished "${task.title}"`, body: text.slice(0, 500), employeeId: employee.id, taskId: task.id });
        return "completed";
      }

      return await fail(`The model stopped for an unexpected reason (${resp.stopReason}).`, { retryable: false });
    }
    return await fail(`The task did not finish within ${maxSteps} steps.`, { retryable: false });
  } catch (e) {
    // Infrastructure failure (database, etc.): leave it retryable rather than losing the task.
    return await fail(`Unexpected engine error: ${e instanceof Error ? e.message : String(e)}`, { retryable: true });
  } finally {
    clearTimeout(timer);
  }
}
