import { describe, expect, it } from "vitest";
import { ProviderError } from "@/lib/ai";
import { processQueue } from "./queue";
import { runTask, type EngineDeps } from "./runTask";
import { replyToChat } from "./chat";
import { FakeProvider, MemoryStore, failWith, reply, toolCall } from "./testing";
import { hashToolCall } from "./tools";
import { MISSING_KEY_MESSAGE, requireAnthropicKey, resolveAnthropicKey } from "./keys";
import type { ToolGrant } from "./store";

const OWNER = "owner-1";
const grant = (slug: string, requiresApproval = false): ToolGrant => ({ slug, name: slug, description: "", requiresApproval, riskLevel: "low" });

function setup(grants: ToolGrant[] = [], provider?: FakeProvider) {
  const store = new MemoryStore();
  const emp = store.addEmployee({ id: "e-seo", ownerId: OWNER, slug: "seo", name: "Noah" }, grants);
  const other = store.addEmployee({ id: "e-dev", ownerId: OWNER, slug: "dev", name: "Kenji" });
  const stranger = store.addEmployee({ id: "e-x", ownerId: "owner-2", slug: "spy", name: "Mallory" });
  const p = provider ?? new FakeProvider(() => reply("All done."));
  const deps: EngineDeps = { store, getProvider: () => p, workerId: "w1", backoffMs: () => 1000 };
  return { store, emp, other, stranger, p, deps };
}
const claim = async (s: ReturnType<typeof setup>, over: Parameters<MemoryStore["addTask"]>[0] = { ownerId: OWNER, employeeId: "e-seo" }) => {
  s.store.addTask(over);
  return (await s.store.claimNextTask("w1"))!;
};

describe("runTask — happy path", () => {
  it("completes the task, records the execution, cost, logs, notification and employee status changes", async () => {
    const s = setup();
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("completed");

    const t = s.store.tasks.get(task.id)!;
    expect(t.status).toBe("completed");
    expect(t.result).toBe("All done.");
    const ex = s.store.executions[0];
    expect(ex.patch?.status).toBe("succeeded");
    expect(ex.patch?.inputTokens).toBe(1000);
    expect(ex.patch?.outputTokens).toBe(200);
    // 1000*4/1e6 + 200*20/1e6 = 0.008 (estimate for claude-opus-5-5)
    expect(ex.patch?.costUsd).toBeCloseTo(0.008, 6);
    expect(s.store.statusHistory.map((h) => h.status)).toEqual(["thinking", "thinking", "completed"]);
    expect(s.store.logs.map((l) => l.eventType)).toEqual(expect.arrayContaining(["task.started", "model.response", "task.completed"]));
    expect(s.store.notifications.map((n) => n.type)).toEqual(["task_completed"]);
  });

  it("sends the employee's instructions, memories and the task to the model", async () => {
    const s = setup([grant("calendar")]);
    s.store.memories.push({ id: "m1", kind: "preference", content: "CEO likes bullet points", importance: 5, employeeId: "e-seo", ownerId: OWNER });
    const task = await claim(s, { ownerId: OWNER, employeeId: "e-seo", title: "Audit homepage", description: "Check titles." });
    await runTask(s.deps, task);
    const req = s.p.requests[0];
    expect(req.system).toContain("You are a test employee.");
    expect(req.system).toContain("CEO likes bullet points");
    expect(req.system).toContain("NOT connected yet");       // calendar is granted but unimplemented
    expect(req.system).toContain("calendar");
    expect(JSON.stringify(req.messages)).toContain("Audit homepage");
    expect(req.model).toBe("claude-opus-5-5");
  });
});

describe("runTask — tools and permissions", () => {
  it("runs a granted tool, feeds the result back, and replays thinking blocks verbatim", async () => {
    const p = new FakeProvider((_r, n) => (n === 1 ? toolCall("save_memory", { content: "Brand voice is playful", importance: 4 }) : reply("Noted and finished.")));
    const s = setup([], p);
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("completed");
    expect(s.store.memories).toHaveLength(1);
    expect(s.store.memories[0]).toMatchObject({ content: "Brand voice is playful", importance: 4, employeeId: "e-seo" });
    const second = JSON.stringify(p.requests[1].messages);
    expect(second).toContain("sig-abc");                       // opaque thinking block echoed unchanged
    expect(second).toContain("tool_result");
    expect(s.store.statusHistory.map((h) => h.status)).toContain("working");
  });

  it("denies a tool the employee was never granted and tells the model", async () => {
    const p = new FakeProvider((_r, n) => (n === 1 ? toolCall("delegate_task", { employee: "dev", title: "x" }) : reply("Could not delegate.")));
    const s = setup([], p); // no task_router grant
    const task = await claim(s);
    await runTask(s.deps, task);
    expect([...s.store.tasks.values()].filter((t) => t.employeeId === "e-dev")).toHaveLength(0);
    expect(s.store.logs.some((l) => l.eventType === "tool.denied")).toBe(true);
    expect(JSON.stringify(p.requests[1].messages)).toContain("not available to you");
    expect(p.requests[0].tools.map((t) => t.name)).not.toContain("delegate_task");
  });

  it("rejects invalid tool input without executing the tool", async () => {
    const p = new FakeProvider((_r, n) => (n === 1 ? toolCall("save_memory", { content: "" }) : reply("ok")));
    const s = setup([], p);
    await runTask(s.deps, await claim(s));
    expect(s.store.memories).toHaveLength(0);
    expect(s.store.logs.some((l) => l.eventType === "tool.invalid")).toBe(true);
  });

  it("only exposes web search to employees granted it", async () => {
    const withGrant = setup([grant("web_search")]);
    await runTask(withGrant.deps, await claim(withGrant));
    expect(withGrant.p.requests[0].tools.map((t) => t.name)).toContain("web_search");
    const without = setup([]);
    await runTask(without.deps, await claim(without));
    expect(without.p.requests[0].tools.map((t) => t.name)).not.toContain("web_search");
  });
});

describe("runTask — delegation", () => {
  const delegating = (input: Record<string, unknown>) => new FakeProvider((_r, n) => (n === 1 ? toolCall("delegate_task", input) : reply("Delegated.")));

  it("creates a queued task for a colleague in the same company, linked to the parent", async () => {
    const s = setup([grant("task_router")], delegating({ employee: "dev", title: "Fix sitemap", description: "404s" }));
    const task = await claim(s);
    await runTask(s.deps, task);
    const created = [...s.store.tasks.values()].find((t) => t.employeeId === "e-dev")!;
    expect(created).toMatchObject({ title: "Fix sitemap", status: "queued", parentTaskId: task.id, ownerId: OWNER });
    expect(created.description).toContain("Delegated by Noah");
  });

  it("cannot reach another company's employees or delegate to itself", async () => {
    const a = setup([grant("task_router")], delegating({ employee: "spy", title: "steal" }));
    await runTask(a.deps, await claim(a));
    expect([...a.store.tasks.values()].filter((t) => t.employeeId === "e-x")).toHaveLength(0);
    const b = setup([grant("task_router")], delegating({ employee: "seo", title: "me" }));
    await runTask(b.deps, await claim(b));
    expect([...b.store.tasks.values()].filter((t) => t.title === "me")).toHaveLength(0);
  });

  it("stops delegation chains at the depth limit", async () => {
    const s = setup([grant("task_router")], delegating({ employee: "dev", title: "deep" }));
    const root = s.store.addTask({ ownerId: OWNER, employeeId: "e-dev", status: "completed" });
    const mid = s.store.addTask({ ownerId: OWNER, employeeId: "e-dev", status: "completed", parentTaskId: root.id });
    const task = await claim(s, { ownerId: OWNER, employeeId: "e-seo", parentTaskId: mid.id });
    await runTask(s.deps, task);
    expect([...s.store.tasks.values()].filter((t) => t.title === "deep")).toHaveLength(0);
    expect(s.store.logs.find((l) => l.eventType === "tool.result")?.message).toContain("too deep");
  });
});

describe("runTask — approvals", () => {
  const publish = { platform: "x", text: "Big launch!", paid: true, budget_usd: 200 };
  const publisher = () => new FakeProvider((_r, n) => (n === 1 ? toolCall("publish_social_post", publish) : n === 2 ? reply("Post handled.") : reply("Post handled.")));

  it("pauses the task and creates an approval instead of running a sensitive tool", async () => {
    const s = setup([grant("social_publish", true)], publisher());
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("waiting");
    expect(s.store.tasks.get(task.id)!.status).toBe("waiting_for_approval");
    expect(s.store.employees.get("e-seo")!.status).toBe("waiting_for_approval");
    expect(s.store.approvals).toHaveLength(1);
    expect(s.store.approvals[0]).toMatchObject({ status: "pending", actionType: "publish_advertisement" });
    expect(s.store.approvals[0].description).toContain("$200");
    expect(s.store.notifications.map((n) => n.type)).toContain("approval_requested");
    expect(s.store.executions[0].patch?.status).toBe("waiting_for_approval");
  });

  it("does not resume while the approval is still pending", async () => {
    const s = setup([grant("social_publish", true)], publisher());
    await runTask(s.deps, await claim(s));
    expect(await processQueue(s.deps)).toHaveLength(0);
  });

  it("re-queues on approval and lets exactly that tool call run exactly once", async () => {
    // Calls the tool until it has seen a tool_result in the conversation, then wraps up.
    const p = new FakeProvider((r, n) =>
      JSON.stringify(r.messages).includes("tool_result") ? reply("Handled.") : toolCall("publish_social_post", publish, `tu_${n}`),
    );
    const s = setup([grant("social_publish", true)], p);
    const task = await claim(s);
    await runTask(s.deps, task);
    s.store.approvals[0].status = "approved";

    const results = await processQueue(s.deps);
    expect(results).toEqual([{ taskId: task.id, outcome: "completed" }]);
    expect(s.store.approvals[0].consumed).toBe(true);
    // The tool ran but, with no integration connected, reported honestly that nothing was sent.
    expect(JSON.stringify(p.requests.at(-1)!.messages)).toContain("not connected yet");
    expect(s.store.executions.map((e) => e.attempt)).toEqual([1, 2]);

    // A repeat of the same call now needs a fresh approval (single use).
    const again = s.store.addTask({ ownerId: OWNER, employeeId: "e-seo" });
    s.store.approvals[0].taskId = again.id; // even if re-pointed, it is consumed
    const c2 = (await s.store.claimNextTask("w1"))!;
    expect(await runTask(s.deps, c2)).toBe("waiting");
  });

  it("an approval for different input does not authorise a different call", async () => {
    const s = setup([grant("social_publish", true)], new FakeProvider(() => toolCall("publish_social_post", { ...publish, budget_usd: 9999 })));
    const task = await claim(s);
    s.store.approvals.push({
      id: "a0", taskId: task.id, status: "approved", description: "old", decisionNote: null, ownerId: OWNER, employeeId: "e-seo", executionId: "x",
      payload: { grant: "social_publish", inputHash: hashToolCall("publish_social_post", publish) }, consumed: false, actionType: "publish_advertisement",
    });
    expect(await runTask(s.deps, task)).toBe("waiting"); // budget differs -> new approval required
    expect(s.store.approvals.filter((a) => a.status === "pending")).toHaveLength(1);
  });

  it("fails the task when the CEO rejects", async () => {
    const s = setup([grant("social_publish", true)], publisher());
    const task = await claim(s);
    await runTask(s.deps, task);
    s.store.approvals[0].status = "rejected";
    s.store.approvals[0].decisionNote = "too expensive";
    await processQueue(s.deps);
    const t = s.store.tasks.get(task.id)!;
    expect(t.status).toBe("failed");
    expect(t.error).toContain("rejected");
    expect(t.error).toContain("too expensive");
    expect(s.store.employees.get("e-seo")!.status).toBe("idle");
  });
});

describe("runTask — failures, retries, timeouts, cancellation", () => {
  it("re-queues with backoff after a retryable provider error, then fails permanently when attempts run out", async () => {
    const s = setup([], new FakeProvider(failWith("overloaded", true)));
    s.store.addTask({ ownerId: OWNER, employeeId: "e-seo", maxAttempts: 2 });
    const t1 = (await s.store.claimNextTask("w1"))!;
    expect(await runTask(s.deps, t1)).toBe("retry");
    const stored = s.store.tasks.get(t1.id)!;
    expect(stored.status).toBe("queued");
    expect(stored.runAfter.getTime()).toBeGreaterThan(Date.now());   // backoff in the future
    expect(await s.store.claimNextTask("w1")).toBeNull();            // not claimable until run_after

    stored.runAfter = new Date(0);
    const t2 = (await s.store.claimNextTask("w1"))!;
    expect(await runTask(s.deps, t2)).toBe("failed");
    expect(s.store.tasks.get(t1.id)!.status).toBe("failed");
    expect(s.store.employees.get("e-seo")!.status).toBe("error");
    expect(s.store.notifications.map((n) => n.type)).toContain("task_failed");
    expect(s.store.executions.map((e) => e.patch?.status)).toEqual(["failed", "failed"]);
  });

  it("fails immediately on a non-retryable error (e.g. bad API key)", async () => {
    const s = setup([], new FakeProvider(failWith("auth", false)));
    expect(await runTask(s.deps, await claim(s))).toBe("failed");
    expect(s.store.executions).toHaveLength(1);
  });

  it("fails clearly when the provider is not configured", async () => {
    const s = setup();
    s.deps.getProvider = () => { throw new ProviderError("ANTHROPIC_API_KEY is not configured on the server.", "auth", false); };
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("failed");
    expect(s.store.tasks.get(task.id)!.error).toContain("ANTHROPIC_API_KEY");
  });

  it("times out a hung model call and marks the execution timed_out", async () => {
    const hang = new FakeProvider(
      (req) => new Promise((_, reject) => req.signal!.addEventListener("abort", () => reject(new ProviderError("aborted", "aborted", true)))),
    );
    // FakeProvider strips the signal when recording, so pass it through a custom provider instead.
    const provider = { name: "anthropic", complete: (req: Parameters<typeof hang.complete>[0]) => new Promise<never>((_, rej) => req.signal!.addEventListener("abort", () => rej(new ProviderError("aborted", "aborted", true)))) };
    const s = setup([], hang);
    s.deps.getProvider = () => provider;
    s.store.addTask({ ownerId: OWNER, employeeId: "e-seo", timeoutSeconds: 0.05, maxAttempts: 1 });
    const task = (await s.store.claimNextTask("w1"))!;
    expect(await runTask(s.deps, task)).toBe("failed");
    expect(s.store.executions[0].patch?.status).toBe("timed_out");
    expect(s.store.tasks.get(task.id)!.error).toContain("Timed out");
  });

  it("stops without overwriting the CEO's decision when the task is cancelled mid-run", async () => {
    const p = new FakeProvider((_r, n) => (n === 1 ? toolCall("save_memory", { content: "x" }) : reply("should never get here")));
    const s = setup([], p);
    const task = await claim(s);
    let calls = 0;
    s.store.onGetTask = () => { if (++calls === 2) s.store.tasks.get(task.id)!.status = "cancelled"; };
    expect(await runTask(s.deps, task)).toBe("stopped");
    expect(s.store.tasks.get(task.id)!.status).toBe("cancelled");     // untouched
    expect(p.requests).toHaveLength(1);                                // no second model call
    expect(s.store.executions[0].patch?.status).toBe("cancelled");
    expect(s.store.employees.get("e-seo")!.status).toBe("idle");
  });

  it("never overwrites a CEO-imposed pause on the employee while the running task stops", async () => {
    const p = new FakeProvider((_r, n) => (n === 1 ? toolCall("save_memory", { content: "x" }) : reply("never")));
    const s = setup([], p);
    const task = await claim(s);
    let calls = 0;
    s.store.onGetTask = () => {
      if (++calls === 2) { s.store.tasks.get(task.id)!.status = "paused"; s.store.employees.get("e-seo")!.status = "paused"; }
    };
    expect(await runTask(s.deps, task)).toBe("stopped");
    expect(s.store.employees.get("e-seo")!.status).toBe("paused");
    expect(s.store.currentTask.get("e-seo")).toBeNull();
  });

  it("gives up on a model that never stops calling tools", async () => {
    const p = new FakeProvider((_r, n) => toolCall("save_memory", { content: `m${n}` }, `tu_${n}`));
    const s = setup([], p);
    s.deps.maxSteps = 3;
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("failed");
    expect(s.store.tasks.get(task.id)!.error).toContain("3 steps");
    expect(p.requests).toHaveLength(3);
  });

  it("treats a refusal and a token-limit stop as non-retryable failures", async () => {
    const refusal = setup([], new FakeProvider(() => reply("", { stopReason: "refusal", stopDetail: "safety" })));
    expect(await runTask(refusal.deps, await claim(refusal))).toBe("failed");
    expect(refusal.store.tasks.values().next().value!.error).toContain("declined");
    const cut = setup([], new FakeProvider(() => reply("partial", { stopReason: "max_tokens" })));
    expect(await runTask(cut.deps, await claim(cut))).toBe("failed");
  });
});

describe("queue", () => {
  it("runs the highest priority task first and one task at a time per employee", async () => {
    const s = setup();
    s.store.addTask({ ownerId: OWNER, employeeId: "e-seo", title: "low", priority: "low" });
    s.store.addTask({ ownerId: OWNER, employeeId: "e-seo", title: "urgent", priority: "urgent" });
    const out = await processQueue(s.deps, { maxTasks: 1 });
    expect(out).toHaveLength(1);
    expect(s.store.tasks.get(out[0].taskId)!.title).toBe("urgent");
  });

  it("skips paused employees and respects the owner scope", async () => {
    const s = setup();
    s.store.employees.get("e-seo")!.status = "paused";
    s.store.addTask({ ownerId: OWNER, employeeId: "e-seo" });
    expect(await processQueue(s.deps)).toHaveLength(0);
    s.store.employees.get("e-seo")!.status = "idle";
    s.store.addTask({ ownerId: "owner-2", employeeId: "e-x", title: "theirs" });
    const mine = await processQueue(s.deps, { ownerId: OWNER });
    expect(mine.map((r) => s.store.tasks.get(r.taskId)!.ownerId)).toEqual([OWNER]);
  });
});

describe("chat", () => {
  const chatSetup = (script: ConstructorParameters<typeof FakeProvider>[0]) => {
    const s = setup([grant("social_publish", true), grant("task_router")]);
    s.store.history.set("c1", [{ role: "user", content: "How is the audit going?" }]);
    const provider = new FakeProvider(script);
    return { ...s, provider };
  };

  it("answers with the real model, saves the assistant message and restores the employee's status", async () => {
    const s = chatSetup(() => reply("Halfway through, found 3 issues."));
    const out = await replyToChat({ store: s.store, provider: s.provider }, { ownerId: OWNER, employeeId: "e-seo", conversationId: "c1" });
    expect(out.reply).toBe("Halfway through, found 3 issues.");
    expect(s.store.assistantMessages).toHaveLength(1);
    expect(s.store.assistantMessages[0]).toMatchObject({ conversationId: "c1", content: "Halfway through, found 3 issues." });
    expect(s.store.employees.get("e-seo")!.status).toBe("idle");
    expect(s.store.statusHistory.map((h) => h.status)).toEqual(["thinking", "idle"]);
    expect(JSON.stringify(s.provider.requests[0].messages)).toContain("How is the audit going?");
  });

  it("offers only memory and low-risk task creation in chat — never publishing, email, refunds or web access", async () => {
    const s = chatSetup(() => reply("ok"));
    await replyToChat({ store: s.store, provider: s.provider }, { ownerId: OWNER, employeeId: "e-seo", conversationId: "c1" });
    expect(s.provider.requests[0].tools.map((t) => t.name).sort()).toEqual(["create_task", "save_memory"]);
  });

  it("does not touch the status of an employee who is busy, and surfaces provider errors", async () => {
    const s = chatSetup(failWith("rate_limit", true));
    s.store.employees.get("e-seo")!.status = "working";
    await expect(replyToChat({ store: s.store, provider: s.provider }, { ownerId: OWNER, employeeId: "e-seo", conversationId: "c1" })).rejects.toThrow(/rate_limit/);
    expect(s.store.statusHistory).toHaveLength(0);
    expect(s.store.logs.some((l) => l.eventType === "chat.error")).toBe(true);
  });

  it("refuses to chat as an employee of another company", async () => {
    const s = chatSetup(() => reply("hi"));
    await expect(replyToChat({ store: s.store, provider: s.provider }, { ownerId: "owner-2", employeeId: "e-seo", conversationId: "c1" })).rejects.toThrow(/not found/i);
  });
});

describe("API key resolution", () => {
  it("prefers the CEO's saved key, falls back to the server key, and otherwise reports a clear error", async () => {
    const store = new MemoryStore();
    store.secrets.set("owner-1:anthropic_api_key", "sk-ant-owner-key");
    expect(await resolveAnthropicKey(store, "owner-1", "sk-ant-env-key")).toBe("sk-ant-owner-key");
    expect(await resolveAnthropicKey(store, "owner-2", "sk-ant-env-key")).toBe("sk-ant-env-key");   // never another owner's key
    expect(await resolveAnthropicKey(store, "owner-2", undefined)).toBeNull();
    expect(await resolveAnthropicKey(store, "owner-2", "")).toBeNull();
    await expect(requireAnthropicKey(store, "owner-2")).rejects.toThrow(MISSING_KEY_MESSAGE);
  });

  it("fails the task with the Settings hint (no retry) when no key exists", async () => {
    const s = setup();
    s.deps.getProvider = async (_n, ownerId) => { await requireAnthropicKey(s.store, ownerId); return s.p; };
    const task = await claim(s);
    expect(await runTask(s.deps, task)).toBe("failed");
    expect(s.store.tasks.get(task.id)!.error).toContain("Settings");
    expect(s.store.executions).toHaveLength(0);       // never reached the model
  });

  it("resolves the provider per owner, so each CEO's own key is used", async () => {
    const s = setup();
    const seen: string[] = [];
    s.deps.getProvider = async (_n, ownerId) => { seen.push(ownerId); return s.p; };
    await runTask(s.deps, await claim(s));
    expect(seen).toEqual([OWNER]);
  });
});

describe("chat: creating tasks for colleagues (Ada)", () => {
  const adaSetup = (script: ConstructorParameters<typeof FakeProvider>[0], grants: ToolGrant[] = [grant("task_router")]) => {
    const s = setup(grants);
    s.store.history.set("c1", [{ role: "user", content: "Get Kai to fix the pricing bug" }]);
    return { ...s, provider: new FakeProvider(script) };
  };
  const run = (s: ReturnType<typeof adaSetup>) => replyToChat({ store: s.store, provider: s.provider }, { ownerId: OWNER, employeeId: "e-seo", conversationId: "c1" });
  const wantsTask = (input: Record<string, unknown>) => (r: { messages: unknown }, n: number) =>
    JSON.stringify(r.messages).includes("tool_result") ? reply("Done — assigned.") : toolCall("create_task", input, `tu_${n}`);

  it("creates a queued task for the named colleague and records it on the reply", async () => {
    const s = adaSetup(wantsTask({ employee: "dev", title: "Fix pricing bug", description: "NGN rounding", priority: "high" }));
    const out = await run(s);
    const task = [...s.store.tasks.values()].find((t) => t.employeeId === "e-dev")!;
    expect(task).toMatchObject({ title: "Fix pricing bug", status: "queued", priority: "high", ownerId: OWNER, parentTaskId: null });
    expect(task.description).toContain("Requested by the CEO via");
    expect(out.createdTaskIds).toEqual([task.id]);
    expect(s.store.assistantMessages[0].metadata).toMatchObject({ taskIds: [task.id] });
  });

  it("tells the model who it can assign to (not itself) and offers the tool only with the grant", async () => {
    const withGrant = adaSetup(() => reply("ok"));
    await run(withGrant);
    const req = withGrant.provider.requests[0];
    expect(req.tools.map((t) => t.name)).toEqual(expect.arrayContaining(["save_memory", "create_task"]));
    expect(req.system).toContain("dev: Kenji");
    expect(req.system).not.toContain("seo: ");
    const without = adaSetup(() => reply("ok"), []);
    await run(without);
    expect(without.provider.requests[0].tools.map((t) => t.name)).toEqual(["save_memory"]);
    expect(without.provider.requests[0].system).not.toContain("create_task");
  });

  it("refuses self-assignment, unknown slugs and other companies' employees", async () => {
    for (const slug of ["seo", "nobody", "spy"]) {
      const s = adaSetup(wantsTask({ employee: slug, title: "x" }));
      await run(s);
      expect([...s.store.tasks.values()]).toHaveLength(0);
    }
  });

  it("limits how many tasks one message can create", async () => {
    const s = adaSetup((_r, n) => (n <= 5 ? toolCall("create_task", { employee: "dev", title: `t${n}` }, `tu_${n}`) : reply("done")));
    await run(s).catch(() => {});
    expect([...s.store.tasks.values()].filter((t) => t.employeeId === "e-dev").length).toBe(3);
  });
});
