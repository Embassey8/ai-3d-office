import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeStatus } from "@/lib/employees/types";
import {
  mapActivity, mapEmployee, mapMessage, mapTask,
  type ActivityRow, type EmployeeRow, type MessageRow, type TaskRow,
} from "./mappers";
import {
  EmployeeConfigSchema, NewTaskSchema, canDo, isEditable,
  type CeoTaskAction, type NewTaskInput, CEO_TASK_ACTIONS,
} from "./schemas";
import type { Conversation, PendingApproval, Task } from "./types";
import { useEmployeeStore } from "@/store/employees";

const fail = (error: { message: string } | null, what: string) => {
  if (error) throw new Error(`${what}: ${error.message}`);
};

async function fetchCounts(sb: SupabaseClient) {
  const [a, n] = await Promise.all([
    sb.from("approvals").select("id", { count: "exact", head: true }).eq("status", "pending"),
    sb.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { pendingApprovals: a.count ?? 0, unreadNotifications: n.count ?? 0 };
}

async function fetchPendingApprovals(sb: SupabaseClient): Promise<PendingApproval[]> {
  const { data, error } = await sb.from("approvals").select("id, employee_id, task_id, action_type, description, created_at").eq("status", "pending").order("created_at");
  fail(error, "Loading approvals");
  return ((data ?? []) as { id: string; employee_id: string; task_id: string | null; action_type: string; description: string; created_at: string }[]).map((a) => ({
    id: a.id, employeeId: a.employee_id, taskId: a.task_id, actionType: a.action_type, description: a.description, createdAt: a.created_at,
  }));
}

async function fetchCostDetail(sb: SupabaseClient): Promise<{ total: number; todayByEmployee: Record<string, number> }> {
  const { data, error } = await sb.from("task_executions").select("employee_id, cost_usd, started_at").limit(5000);
  if (error) return { total: 0, todayByEmployee: {} };
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  let total = 0;
  const todayByEmployee: Record<string, number> = {};
  for (const r of data as { employee_id: string; cost_usd: number | string; started_at: string }[]) {
    const c = Number(r.cost_usd);
    total += c;
    if (new Date(r.started_at) >= dayStart) todayByEmployee[r.employee_id] = (todayByEmployee[r.employee_id] ?? 0) + c;
  }
  return { total, todayByEmployee };
}
const fetchCost = async (sb: SupabaseClient) => (await fetchCostDetail(sb)).total;

/** Loads everything the office needs. All queries run as the signed-in user, so RLS applies. */
export async function loadCompany(sb: SupabaseClient) {
  const { data: userData } = await sb.auth.getUser();
  const [emps, empTools, tasks, activity, convs, counts, costDetail, approvals, mem] = await Promise.all([
    sb.from("employees").select("*, departments(name)").order("created_at"),
    sb.from("employee_tools").select("employee_id, enabled, tools(slug)").eq("enabled", true),
    sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("conversations").select("id, employee_id"),
    fetchCounts(sb),
    fetchCostDetail(sb),
    fetchPendingApprovals(sb),
    sb.from("employee_memories").select("employee_id").limit(5000),
  ]);
  fail(emps.error, "Loading employees");
  fail(empTools.error, "Loading employee tools");
  fail(tasks.error, "Loading tasks");
  fail(activity.error, "Loading activity");
  fail(convs.error, "Loading conversations");

  const toolsByEmployee = new Map<string, string[]>();
  for (const row of (empTools.data ?? []) as unknown as { employee_id: string; tools: { slug: string } | null }[]) {
    if (!row.tools) continue;
    toolsByEmployee.set(row.employee_id, [...(toolsByEmployee.get(row.employee_id) ?? []), row.tools.slug]);
  }
  const employeeRows = (emps.data ?? []) as unknown as EmployeeRow[];
  return {
    userEmail: userData.user?.email ?? null,
    userId: userData.user?.id ?? null,
    employees: employeeRows.map((r) => mapEmployee(r, toolsByEmployee.get(r.id) ?? [])),
    statuses: Object.fromEntries(employeeRows.map((r) => [r.id, r.status])) as Record<string, EmployeeStatus>,
    tasks: ((tasks.data ?? []) as TaskRow[]).map(mapTask),
    activity: ((activity.data ?? []) as ActivityRow[]).map(mapActivity),
    conversations: ((convs.data ?? []) as { id: string; employee_id: string }[]).map(
      (c): Conversation => ({ id: c.id, employeeId: c.employee_id }),
    ),
    ...counts,
    pendingApprovals: approvals.length,
    approvals,
    estimatedCostUsd: costDetail.total,
    costTodayByEmployee: costDetail.todayByEmployee,
    memoryCount: (mem.data ?? []).length,
    memoryByEmployee: ((mem.data ?? []) as { employee_id: string }[]).reduce<Record<string, number>>((m, r) => { m[r.employee_id] = (m[r.employee_id] ?? 0) + 1; return m; }, {}),
  };
}

/**
 * Subscribes to row changes for the signed-in CEO. Realtime applies RLS too, so only the
 * user's own rows are delivered; the owner filter just keeps traffic small.
 */
export function subscribeRealtime(sb: SupabaseClient, userId: string): () => void {
  const st = () => useEmployeeStore.getState();
  const filter = `owner_id=eq.${userId}`;
  const refreshCounts = () => void fetchCounts(sb).then((c) => st().setCounts(c)).catch(() => {});
  const refreshApprovals = () => void fetchPendingApprovals(sb).then((a) => st().setApprovals(a)).catch(() => {});
  const refreshCost = () => void fetchCost(sb).then((c) => st().setCost(c)).catch(() => {});

  const channel: RealtimeChannel = sb
    .channel(`office:${userId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "employees", filter }, (p) =>
      st().applyEmployeeRow(p.new as EmployeeRow),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, (p) => {
      if (p.eventType === "DELETE") st().removeTask((p.old as { id: string }).id);
      else st().upsertTask(mapTask(p.new as TaskRow));
    })
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_logs", filter }, (p) =>
      st().addActivity(mapActivity(p.new as ActivityRow)),
    )
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) =>
      st().addMessage(mapMessage(p.new as MessageRow)),
    )
    .on("postgres_changes", { event: "*", schema: "public", table: "task_executions", filter }, refreshCost)
    .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter }, refreshApprovals)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter }, refreshCounts)
    .subscribe();

  return () => void sb.removeChannel(channel);
}

/* ------------------------------ CEO actions ------------------------------ */

export async function createTask(sb: SupabaseClient, input: NewTaskInput): Promise<Task> {
  const t = NewTaskSchema.parse(input);
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("You are signed out.");
  const { data, error } = await sb
    .from("tasks")
    .insert({
      owner_id: u.user.id,
      employee_id: t.employeeId,
      title: t.title,
      description: t.description,
      priority: t.priority,
      deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
    })
    .select("*")
    .single();
  fail(error, "Creating task");
  const task = mapTask(data as TaskRow);
  useEmployeeStore.getState().upsertTask(task);
  return task;
}

export async function changeTaskStatus(sb: SupabaseClient, task: Task, action: CeoTaskAction) {
  if (!canDo(action, task.status)) throw new Error(`Cannot ${action} a ${task.status} task.`);
  const { data, error } = await sb
    .from("tasks").update({ status: CEO_TASK_ACTIONS[action].to }).eq("id", task.id).select("*").single();
  fail(error, `Could not ${action} task`);
  useEmployeeStore.getState().upsertTask(mapTask(data as TaskRow));
}

export async function editTask(
  sb: SupabaseClient, task: Task,
  patch: { title: string; description: string; priority: Task["priority"] },
) {
  if (!isEditable(task.status)) throw new Error("Only queued or paused tasks can be edited.");
  const parsed = NewTaskSchema.pick({ title: true, description: true, priority: true }).parse(patch);
  const { data, error } = await sb.from("tasks").update(parsed).eq("id", task.id).select("*").single();
  fail(error, "Could not edit task");
  useEmployeeStore.getState().upsertTask(mapTask(data as TaskRow));
}

export async function saveEmployeeConfig(
  sb: SupabaseClient, employeeId: string,
  cfg: { personality: string; systemInstructions: string; modelName: string },
) {
  const c = EmployeeConfigSchema.parse(cfg);
  const { data, error } = await sb
    .from("employees")
    .update({ personality: c.personality, system_instructions: c.systemInstructions, model_name: c.modelName })
    .eq("id", employeeId).select("*").single();
  fail(error, "Could not save employee settings");
  useEmployeeStore.getState().applyEmployeeRow(data as EmployeeRow);
}

export async function loadMessages(sb: SupabaseClient, conversationId: string) {
  const { data, error } = await sb
    .from("messages").select("*").eq("conversation_id", conversationId).order("created_at").limit(200);
  fail(error, "Loading messages");
  useEmployeeStore.getState().setMessages(conversationId, ((data ?? []) as MessageRow[]).map(mapMessage));
}

/** Error from one of our API routes, with the server's own explanation. */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) { super(message); }
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string; code?: string };
  if (!res.ok) throw new ApiError(json.error ?? `Request failed (${res.status})`, res.status, json.code);
  return json;
}

/**
 * Sends a CEO message to the employee's REAL model through /api/chat. The server saves both the
 * message and the reply; we then refresh the conversation from the database.
 */
export async function sendChat(sb: SupabaseClient, employeeId: string, content: string): Promise<void> {
  const text = content.trim();
  if (!text) throw new Error("Write a message first.");
  let conversationId: string | undefined;
  try {
    const out = await api<{ conversationId: string }>("/api/chat", { employeeId, message: text });
    conversationId = out.conversationId;
  } finally {
    // Even when the reply failed the CEO's message may have been saved: re-sync from the database.
    const st = useEmployeeStore.getState();
    const { data } = await sb.from("conversations").select("id, employee_id").eq("employee_id", employeeId).order("created_at").limit(1).maybeSingle();
    const convId = conversationId ?? (data as { id: string } | null)?.id;
    if (convId) {
      st.addConversation({ id: convId, employeeId });
      await loadMessages(sb, convId);
    }
  }
}

/** Asks the server to start running queued tasks (returns immediately; progress arrives via Realtime). */
export const triggerWorker = () => api<{ accepted: boolean }>("/api/worker/tick");

export const controlEmployee = (employeeId: string, action: "pause" | "resume") =>
  api<{ status: string }>(`/api/employees/${employeeId}/control`, { action });

/** The CEO's decision on a pending approval. The engine picks it up on the next worker run. */
export async function decideApproval(sb: SupabaseClient, approvalId: string, decision: "approved" | "rejected", note = "") {
  const { error } = await sb.from("approvals").update({ status: decision, decision_note: note.trim() || null }).eq("id", approvalId).eq("status", "pending");
  fail(error, "Could not record your decision");
  useEmployeeStore.getState().setApprovals(useEmployeeStore.getState().approvals.filter((a) => a.id !== approvalId));
  // Let the engine resume (approved) or close out (rejected) the waiting task right away.
  await triggerWorker().catch(() => {});
}
