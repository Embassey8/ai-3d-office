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
import type { ChatMessage, Conversation, Task } from "./types";
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

/** Loads everything the office needs. All queries run as the signed-in user, so RLS applies. */
export async function loadCompany(sb: SupabaseClient) {
  const { data: userData } = await sb.auth.getUser();
  const [emps, empTools, tasks, activity, convs, counts] = await Promise.all([
    sb.from("employees").select("*, departments(name)").order("created_at"),
    sb.from("employee_tools").select("employee_id, enabled, tools(slug)").eq("enabled", true),
    sb.from("tasks").select("*").order("created_at", { ascending: false }).limit(500),
    sb.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("conversations").select("id, employee_id"),
    fetchCounts(sb),
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
    .on("postgres_changes", { event: "*", schema: "public", table: "approvals", filter }, refreshCounts)
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

/** Saves a CEO message (creating the conversation on first use). It does NOT get an AI reply yet. */
export async function sendMessage(sb: SupabaseClient, employeeId: string, content: string): Promise<ChatMessage> {
  const text = content.trim();
  if (!text) throw new Error("Write a message first.");
  const { data: u } = await sb.auth.getUser();
  if (!u.user) throw new Error("You are signed out.");
  const st = useEmployeeStore.getState();
  let conv = st.conversations.find((c) => c.employeeId === employeeId);
  if (!conv) {
    const { data, error } = await sb
      .from("conversations").insert({ owner_id: u.user.id, employee_id: employeeId }).select("id, employee_id").single();
    fail(error, "Starting conversation");
    conv = { id: (data as { id: string }).id, employeeId };
    st.addConversation(conv);
    st.setMessages(conv.id, []);
  }
  const { data, error } = await sb
    .from("messages")
    .insert({ owner_id: u.user.id, conversation_id: conv.id, role: "user", content: text })
    .select("*").single();
  fail(error, "Sending message");
  const msg = mapMessage(data as MessageRow);
  useEmployeeStore.getState().addMessage(msg);
  return msg;
}
