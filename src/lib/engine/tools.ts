import { createHash } from "node:crypto";
import { z } from "zod";
import type { ToolSpec } from "@/lib/ai/types";
import type { ApprovalActionType, EmployeeRecord, Store, TaskRecord, ToolGrant } from "./store";

/**
 * Tool gateway. The model can only ever call tools that (a) the employee has been granted in the
 * database and (b) this module actually implements. Nothing here executes shell commands.
 */
export interface ToolContext {
  store: Store;
  employee: EmployeeRecord;
  /** Present when running a task; absent in chat. */
  task: TaskRecord | null;
  counters: { memories: number; delegations: number; createdTaskIds?: string[] };
}

export interface ToolResult {
  content: string;
  isError?: boolean;
}

export interface ToolDef {
  /** The grant slug in `employee_tools` that unlocks this tool ("*" = always available). */
  grant: string;
  /** Also offered in chat (side-effect tools are otherwise task-only). Only for low-risk, reversible actions. */
  chat?: boolean;
  spec: Extract<ToolSpec, { kind: "function" }>;
  schema: z.ZodType<Record<string, unknown>>;
  approval?: { actionType: ApprovalActionType; describe: (input: Record<string, unknown>) => string };
  execute: (ctx: ToolContext, input: Record<string, unknown>) => Promise<ToolResult>;
}

export const MAX_DELEGATION_DEPTH = 2;
const MAX_MEMORIES_PER_RUN = 5;
const MAX_DELEGATIONS_PER_RUN = 3;

const NOT_CONNECTED =
  "The CEO approved this action, but the integration that performs it is not connected yet (planned for Milestone 5). Nothing was sent or changed. Report this honestly in your final answer.";

const saveMemory: ToolDef = {
  grant: "*",
  spec: {
    kind: "function",
    name: "save_memory",
    description:
      "Save a durable fact, preference or lesson that will be shown to you in future conversations and tasks. Use sparingly, only for information worth remembering long-term.",
    inputSchema: {
      type: "object",
      properties: {
        content: { type: "string", description: "The thing to remember, in one or two sentences." },
        kind: { type: "string", enum: ["fact", "preference", "summary", "lesson"] },
        importance: { type: "integer", minimum: 1, maximum: 5 },
      },
      required: ["content"],
    },
  },
  schema: z.object({
    content: z.string().trim().min(1).max(2000),
    kind: z.enum(["fact", "preference", "summary", "lesson"]).default("fact"),
    importance: z.number().int().min(1).max(5).default(3),
  }),
  async execute(ctx, input) {
    if (ctx.counters.memories >= MAX_MEMORIES_PER_RUN)
      return { content: `Memory limit reached (${MAX_MEMORIES_PER_RUN} per run).`, isError: true };
    ctx.counters.memories++;
    await ctx.store.addMemory({
      ownerId: ctx.employee.ownerId,
      employeeId: ctx.employee.id,
      kind: input.kind as "fact",
      content: input.content as string,
      importance: input.importance as number,
      sourceTaskId: ctx.task?.id ?? null,
    });
    return { content: "Saved to your memory." };
  },
};

const delegateTask: ToolDef = {
  grant: "task_router",
  spec: {
    kind: "function",
    name: "delegate_task",
    description:
      "Create a task for another employee. Use the employee's slug (e.g. 'seo', 'dev', 'research'). The new task is queued for them; you will not receive their result in this run.",
    inputSchema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "Slug of the employee to assign the task to." },
        title: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      },
      required: ["employee", "title"],
    },
  },
  schema: z.object({
    employee: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20000).default(""),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  }),
  async execute(ctx, input) {
    if (!ctx.task) return { content: "Delegation is only available while working on a task.", isError: true };
    if (ctx.counters.delegations >= MAX_DELEGATIONS_PER_RUN)
      return { content: `Delegation limit reached (${MAX_DELEGATIONS_PER_RUN} per run).`, isError: true };

    // Bound delegation chains: walk up the parent links.
    let depth = 0;
    let cursor: TaskRecord | null = ctx.task;
    while (cursor?.parentTaskId && depth <= MAX_DELEGATION_DEPTH) {
      depth++;
      cursor = await ctx.store.getTask(cursor.parentTaskId);
    }
    if (depth >= MAX_DELEGATION_DEPTH)
      return { content: `Delegation chain is too deep (max ${MAX_DELEGATION_DEPTH}). Do the work yourself or report back.`, isError: true };

    // Scoped to the same owner, so another company's employees are unreachable.
    const target = await ctx.store.getEmployeeBySlug(ctx.employee.ownerId, input.employee as string);
    if (!target) return { content: `No employee with slug "${input.employee}".`, isError: true };
    if (target.id === ctx.employee.id) return { content: "You cannot delegate a task to yourself.", isError: true };

    const id = await ctx.store.createTask({
      ownerId: ctx.employee.ownerId,
      employeeId: target.id,
      parentTaskId: ctx.task.id,
      title: input.title as string,
      description: `Delegated by ${ctx.employee.name} (${ctx.employee.title}).\n\n${input.description as string}`.trim(),
      priority: input.priority as "normal",
    });
    ctx.counters.delegations++;
    return { content: `Task created for ${target.name} (id ${id}). It is queued and will run separately.` };
  },
};

const createTask: ToolDef = {
  grant: "task_router",
  chat: true,
  spec: {
    kind: "function",
    name: "create_task",
    description:
      "Create a task for a colleague (use their slug from the roster). Use this when the CEO asks for work that someone else should do. The task is queued and runs separately; you will not see its result in this conversation. Tasks are visible to the CEO, who can pause or cancel them.",
    inputSchema: {
      type: "object",
      properties: {
        employee: { type: "string", description: "Slug of the colleague who should do the work." },
        title: { type: "string", description: "Short imperative title." },
        description: { type: "string", description: "Everything the colleague needs: goal, context, constraints, deadline." },
        priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
      },
      required: ["employee", "title"],
    },
  },
  schema: z.object({
    employee: z.string().trim().min(1).max(64),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(20000).default(""),
    priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  }),
  async execute(ctx, input) {
    if (ctx.counters.delegations >= MAX_DELEGATIONS_PER_RUN)
      return { content: `Task limit reached (${MAX_DELEGATIONS_PER_RUN} per message). Ask the CEO to confirm before creating more.`, isError: true };
    // Scoped to the same company, so another CEO's employees are unreachable.
    const target = await ctx.store.getEmployeeBySlug(ctx.employee.ownerId, input.employee as string);
    if (!target) return { content: `No employee with slug "${input.employee}".`, isError: true };
    if (target.id === ctx.employee.id) return { content: "Do not assign tasks to yourself in chat; answer directly instead.", isError: true };
    const id = await ctx.store.createTask({
      ownerId: ctx.employee.ownerId,
      employeeId: target.id,
      parentTaskId: ctx.task?.id ?? null,
      title: input.title as string,
      description: `Requested by the CEO via ${ctx.employee.name} (${ctx.employee.title}).\n\n${input.description as string}`.trim(),
      priority: input.priority as "normal",
    });
    ctx.counters.delegations++;
    (ctx.counters.createdTaskIds ??= []).push(id);
    return { content: `Task created for ${target.name} (id ${id}). It is queued and will start shortly.` };
  },
};

const gated = (
  grant: string, name: string, description: string,
  props: Record<string, unknown>, required: string[], schema: z.ZodType<Record<string, unknown>>,
  actionType: ApprovalActionType, describe: (i: Record<string, unknown>) => string,
): ToolDef => ({
  grant,
  spec: { kind: "function", name, description: `${description} REQUIRES CEO APPROVAL: calling it pauses your task until the CEO decides.`, inputSchema: { type: "object", properties: props, required } },
  schema,
  approval: { actionType, describe },
  async execute() {
    return { content: NOT_CONNECTED, isError: true };
  },
});

const publishSocial = gated(
  "social_publish", "publish_social_post", "Publish a post (or paid ad) to a social network.",
  { platform: { type: "string" }, text: { type: "string" }, paid: { type: "boolean" }, budget_usd: { type: "number" } },
  ["platform", "text"],
  z.object({ platform: z.string().min(1).max(40), text: z.string().min(1).max(5000), paid: z.boolean().default(false), budget_usd: z.number().min(0).max(1_000_000).optional() }),
  "publish_advertisement",
  (i) => `Publish to ${i.platform}${i.paid ? ` (paid${i.budget_usd ? `, $${i.budget_usd}` : ""})` : ""}: "${String(i.text).slice(0, 140)}"`,
);
const bulkEmail = gated(
  "bulk_email", "send_bulk_email", "Send one email to a list of recipients.",
  { audience: { type: "string" }, subject: { type: "string" }, body: { type: "string" } }, ["audience", "subject", "body"],
  z.object({ audience: z.string().min(1).max(500), subject: z.string().min(1).max(300), body: z.string().min(1).max(20000) }),
  "send_bulk_communication",
  (i) => `Send bulk email "${i.subject}" to ${i.audience}`,
);
const refund = gated(
  "refund", "issue_refund", "Refund a customer order.",
  { order_id: { type: "string" }, amount_usd: { type: "number" }, reason: { type: "string" } }, ["order_id", "amount_usd", "reason"],
  z.object({ order_id: z.string().min(1).max(100), amount_usd: z.number().positive().max(1_000_000), reason: z.string().min(1).max(1000) }),
  "issue_refund",
  (i) => `Refund $${i.amount_usd} on order ${i.order_id}: ${i.reason}`,
);

export const TOOL_DEFS: readonly ToolDef[] = [saveMemory, delegateTask, createTask, publishSocial, bulkEmail, refund];

/** Anthropic-executed web search. Added only for employees granted `web_search`. */
export const WEB_SEARCH_SPEC: ToolSpec = {
  kind: "server",
  provider: "anthropic",
  name: "web_search",
  spec: { type: "web_search_20260209", name: "web_search", max_uses: 5 },
};

/** Grant slugs that have no implementation yet. Reported to the model so it does not pretend otherwise. */
export const IMPLEMENTED_GRANTS = new Set(["*", "task_router", "web_search", "social_publish", "bulk_email", "refund"]);

export interface ResolvedTools {
  defs: Map<string, ToolDef>;
  specs: ToolSpec[];
  /** Granted tools the engine cannot run yet. */
  unavailable: ToolGrant[];
}

export function resolveTools(grants: ToolGrant[], opts: { chat?: boolean } = {}): ResolvedTools {
  const granted = new Set(grants.map((g) => g.slug));
  const defs = new Map<string, ToolDef>();
  const specs: ToolSpec[] = [];
  for (const d of TOOL_DEFS) {
    if (opts.chat && d.grant !== "*" && !d.chat) continue; // chat: memory + low-risk task creation only
    if (d.grant === "*" || granted.has(d.grant)) {
      defs.set(d.spec.name, d);
      specs.push(d.spec);
    }
  }
  if (!opts.chat && granted.has("web_search")) specs.push(WEB_SEARCH_SPEC);
  return { defs, specs, unavailable: grants.filter((g) => !IMPLEMENTED_GRANTS.has(g.slug)) };
}

/** Stable hash of a tool call so an approval only ever authorises exactly what the CEO saw. */
export function hashToolCall(name: string, input: Record<string, unknown>): string {
  const canon = JSON.stringify(input, Object.keys(input).sort());
  return createHash("sha256").update(`${name}:${canon}`).digest("hex").slice(0, 32);
}
