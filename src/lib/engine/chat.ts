import { ProviderError, estimateCostUsd, textOf, type Block, type Message } from "@/lib/ai";
import { buildSystemPrompt } from "./prompt";
import type { Store } from "./store";
import { resolveTools, type ToolContext } from "./tools";
import type { LLMProvider } from "@/lib/ai";

const CHAT_MAX_STEPS = 3;

/**
 * Answers the CEO's latest message with the employee's real model. The caller has already saved the
 * user's message; history (including it) is read back from the store. Only the memory tool is offered
 * in chat, so a conversation can never trigger side effects.
 */
export async function replyToChat(
  deps: { store: Store; provider: LLMProvider },
  args: { ownerId: string; employeeId: string; conversationId: string },
): Promise<{ reply: string; model: string; costUsd: number | null }> {
  const { store, provider } = deps;
  const employee = await store.getEmployee(args.employeeId);
  if (!employee || employee.ownerId !== args.ownerId) throw new ProviderError("Employee not found.", "bad_request", false);

  const [grants, memories, history] = await Promise.all([
    store.listGrantedTools(employee.id),
    store.listMemories(employee.id, 12),
    store.getConversationHistory(args.conversationId, 30),
  ]);
  const { defs, specs } = resolveTools(grants, { chat: true });
  const system = buildSystemPrompt({ employee, memories, unavailable: [], mode: "chat" });

  const messages: Message[] = history.map((m) => ({ role: m.role, content: [{ type: "text", text: m.content }] as Block[] }));
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") throw new ProviderError("No user message to answer.", "bad_request", false);

  // Show the employee as "thinking" only if nothing else is going on; restore afterwards.
  const prior = employee.status;
  const idleish = prior === "idle" || prior === "completed" || prior === "error";
  if (idleish) await store.updateEmployee(employee.id, { status: "thinking" });

  const ctx: ToolContext = { store, employee, task: null, counters: { memories: 0, delegations: 0 } };
  let cost: number | null = 0;
  try {
    for (let step = 1; step <= CHAT_MAX_STEPS; step++) {
      const resp = await provider.complete({ model: employee.modelName, system, messages, tools: specs, maxTokens: 4096 });
      const c = estimateCostUsd(resp.model, resp.usage);
      cost = c === null || cost === null ? null : cost + c;
      messages.push({ role: "assistant", content: resp.content });

      if (resp.stopReason === "tool_use") {
        const results: Block[] = [];
        for (const call of resp.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use")) {
          const def = defs.get(call.name);
          const parsed = def?.schema.safeParse(call.input);
          if (!def || !parsed?.success) {
            results.push({ type: "tool_result", toolUseId: call.id, content: "Tool not available in chat.", isError: true });
            continue;
          }
          const r = await def.execute(ctx, parsed.data);
          results.push({ type: "tool_result", toolUseId: call.id, content: r.content, isError: r.isError });
        }
        messages.push({ role: "user", content: results });
        continue;
      }
      if (resp.stopReason === "refusal") throw new ProviderError(`The model declined to answer${resp.stopDetail ? `: ${resp.stopDetail}` : "."}`, "bad_request", false);
      if (resp.stopReason === "max_tokens") throw new ProviderError("The reply was cut off by the token limit.", "bad_request", false);
      if (resp.stopReason === "pause_turn") continue;
      const reply = textOf(resp.content);
      if (!reply) throw new ProviderError("The model returned an empty reply.", "unknown", false);
      await store.addAssistantMessage({ ownerId: args.ownerId, conversationId: args.conversationId, content: reply, metadata: { model: resp.model, costUsd: cost, costIsEstimate: true } });
      await store.log({ ownerId: args.ownerId, employeeId: employee.id, eventType: "chat.reply", message: `Replied in chat (${resp.usage.inputTokens} in / ${resp.usage.outputTokens} out tokens).`, metadata: { model: resp.model, costUsd: cost } });
      return { reply, model: resp.model, costUsd: cost };
    }
    throw new ProviderError("The conversation did not settle within the step limit.", "unknown", false);
  } catch (e) {
    await store.log({ ownerId: args.ownerId, employeeId: employee.id, eventType: "chat.error", level: "error", message: e instanceof Error ? e.message : String(e) });
    throw e;
  } finally {
    if (idleish) await store.updateEmployee(employee.id, { status: prior });
  }
}
