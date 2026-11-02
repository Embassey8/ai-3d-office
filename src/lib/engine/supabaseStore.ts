import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmployeeStatus } from "@/lib/employees/types";
import type {
  ApprovalRecord, ChatMessageRecord, EmployeeRecord, ExecutionPatch, LogEntry, MemoryRecord, Store, TaskRecord, ToolGrant,
} from "./store";

/* Row shapes (snake_case) for the columns we read. */
interface TaskRow {
  id: string; owner_id: string; employee_id: string; parent_task_id: string | null; title: string; description: string;
  priority: TaskRecord["priority"]; status: TaskRecord["status"]; deadline: string | null;
  attempts: number; max_attempts: number; timeout_seconds: number;
}
interface EmployeeRow {
  id: string; owner_id: string; slug: string; name: string; title: string; personality: string;
  system_instructions: string; model_provider: string; model_name: string; status: EmployeeStatus;
}

const mapTask = (r: TaskRow): TaskRecord => ({
  id: r.id, ownerId: r.owner_id, employeeId: r.employee_id, parentTaskId: r.parent_task_id, title: r.title,
  description: r.description, priority: r.priority, status: r.status, deadline: r.deadline,
  attempts: r.attempts, maxAttempts: r.max_attempts, timeoutSeconds: r.timeout_seconds,
});
const mapEmployee = (r: EmployeeRow): EmployeeRecord => ({
  id: r.id, ownerId: r.owner_id, slug: r.slug, name: r.name, title: r.title, personality: r.personality,
  systemInstructions: r.system_instructions, modelProvider: r.model_provider, modelName: r.model_name, status: r.status,
});

function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data as T;
}

/** Store over Supabase using the SERVICE ROLE client. Server/worker only — never import from client code. */
export class SupabaseStore implements Store {
  constructor(private sb: SupabaseClient) {}

  async claimNextTask(workerId: string, ownerId?: string) {
    const rows = must(await this.sb.rpc("claim_next_task", { p_worker: workerId, p_owner: ownerId ?? null }), "claim_next_task") as TaskRow[] | null;
    return rows && rows.length ? mapTask(rows[0]) : null;
  }
  async getTask(id: string) {
    const r = must(await this.sb.from("tasks").select("*").eq("id", id).maybeSingle(), "getTask") as TaskRow | null;
    return r ? mapTask(r) : null;
  }
  async updateTask(id: string, p: Parameters<Store["updateTask"]>[1]) {
    const patch: Record<string, unknown> = {};
    if (p.status !== undefined) patch.status = p.status;
    if (p.result !== undefined) patch.result = p.result;
    if (p.error !== undefined) patch.error = p.error;
    if (p.attempts !== undefined) patch.attempts = p.attempts;
    if (p.runAfter) patch.run_after = p.runAfter.toISOString();
    if (p.lockedBy !== undefined) { patch.locked_by = p.lockedBy; if (p.lockedBy === null) patch.locked_at = null; }
    if (p.finished) patch.finished_at = new Date().toISOString();
    if (Object.keys(patch).length === 0) return;
    must(await this.sb.from("tasks").update(patch).eq("id", id), "updateTask");
  }
  async createTask(t: Parameters<Store["createTask"]>[0]) {
    const row = must(
      await this.sb.from("tasks").insert({
        owner_id: t.ownerId, employee_id: t.employeeId, parent_task_id: t.parentTaskId,
        title: t.title, description: t.description, priority: t.priority,
      }).select("id").single(),
      "createTask",
    ) as { id: string };
    return row.id;
  }

  async getEmployee(id: string) {
    const r = must(await this.sb.from("employees").select("*").eq("id", id).maybeSingle(), "getEmployee") as EmployeeRow | null;
    return r ? mapEmployee(r) : null;
  }
  async getEmployeeBySlug(ownerId: string, slug: string) {
    const r = must(await this.sb.from("employees").select("*").eq("owner_id", ownerId).eq("slug", slug).maybeSingle(), "getEmployeeBySlug") as EmployeeRow | null;
    return r ? mapEmployee(r) : null;
  }
  async listEmployees(ownerId: string) {
    const rows = must(await this.sb.from("employees").select("*").eq("owner_id", ownerId).order("created_at"), "listEmployees") as EmployeeRow[] | null;
    return (rows ?? []).map(mapEmployee);
  }
  async updateEmployee(id: string, p: { status?: EmployeeStatus; currentTaskId?: string | null }) {
    const patch: Record<string, unknown> = {};
    if (p.status !== undefined) patch.status = p.status;
    if (p.currentTaskId !== undefined) patch.current_task_id = p.currentTaskId;
    if (Object.keys(patch).length === 0) return;
    must(await this.sb.from("employees").update(patch).eq("id", id), "updateEmployee");
  }
  async listGrantedTools(employeeId: string) {
    const rows = must(
      await this.sb.from("employee_tools").select("tools(slug, name, description, requires_approval, risk_level)").eq("employee_id", employeeId).eq("enabled", true),
      "listGrantedTools",
    ) as unknown as { tools: { slug: string; name: string; description: string; requires_approval: boolean; risk_level: ToolGrant["riskLevel"] } | null }[];
    return rows.flatMap((r) => r.tools ? [{ slug: r.tools.slug, name: r.tools.name, description: r.tools.description, requiresApproval: r.tools.requires_approval, riskLevel: r.tools.risk_level }] : []);
  }

  async listMemories(employeeId: string, limit: number) {
    const rows = must(
      await this.sb.from("employee_memories").select("id, kind, content, importance").eq("employee_id", employeeId)
        .order("importance", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
      "listMemories",
    ) as MemoryRecord[] | null;
    return rows ?? [];
  }
  async addMemory(m: Parameters<Store["addMemory"]>[0]) {
    must(await this.sb.from("employee_memories").insert({
      owner_id: m.ownerId, employee_id: m.employeeId, kind: m.kind, content: m.content, importance: m.importance, source_task_id: m.sourceTaskId ?? null,
    }), "addMemory");
  }

  async startExecution(e: Parameters<Store["startExecution"]>[0]) {
    for (let tries = 0; tries < 3; tries++) {
      const last = must(
        await this.sb.from("task_executions").select("attempt").eq("task_id", e.taskId).order("attempt", { ascending: false }).limit(1),
        "startExecution(attempt)",
      ) as { attempt: number }[] | null;
      const attempt = (last?.[0]?.attempt ?? 0) + 1;
      const res = await this.sb.from("task_executions").insert({
        owner_id: e.ownerId, task_id: e.taskId, employee_id: e.employeeId, attempt, worker_id: e.workerId,
        model_provider: e.provider, model_name: e.model, status: "running",
      }).select("id").single();
      if (!res.error) return { id: (res.data as { id: string }).id, attempt };
      if (!/duplicate key|unique/i.test(res.error.message)) throw new Error(`startExecution: ${res.error.message}`);
    }
    throw new Error("startExecution: could not allocate an attempt number");
  }
  async finishExecution(id: string, p: ExecutionPatch) {
    must(await this.sb.from("task_executions").update({
      status: p.status, output: p.output ?? null, error: p.error ?? null,
      input_tokens: p.inputTokens, output_tokens: p.outputTokens, cost_usd: p.costUsd,
      ...(p.finished ? { finished_at: new Date().toISOString() } : {}),
    }).eq("id", id), "finishExecution");
  }

  async log(e: LogEntry) {
    // Logging must never break a task.
    const { error } = await this.sb.from("activity_logs").insert({
      owner_id: e.ownerId, employee_id: e.employeeId ?? null, task_id: e.taskId ?? null, execution_id: e.executionId ?? null,
      event_type: e.eventType, level: e.level ?? "info", message: e.message.slice(0, 4000), metadata: e.metadata ?? {},
    });
    if (error) console.error("[engine] activity log failed:", error.message);
  }
  async notify(n: Parameters<Store["notify"]>[0]) {
    const { error } = await this.sb.from("notifications").insert({
      owner_id: n.ownerId, type: n.type, title: n.title.slice(0, 300), body: (n.body ?? "").slice(0, 2000),
      employee_id: n.employeeId ?? null, task_id: n.taskId ?? null, approval_id: n.approvalId ?? null,
    });
    if (error) console.error("[engine] notification failed:", error.message);
  }

  async createApproval(a: Parameters<Store["createApproval"]>[0]) {
    const row = must(await this.sb.from("approvals").insert({
      owner_id: a.ownerId, employee_id: a.employeeId, task_id: a.taskId, execution_id: a.executionId,
      action_type: a.actionType, description: a.description, payload: a.payload,
    }).select("id").single(), "createApproval") as { id: string };
    return row.id;
  }
  async findApprovedApproval(taskId: string, toolSlug: string, inputHash: string) {
    const rows = must(
      await this.sb.from("approvals").select("id, task_id, status, description, decision_note")
        .eq("task_id", taskId).eq("status", "approved").is("consumed_at", null)
        .eq("payload->>grant", toolSlug).eq("payload->>inputHash", inputHash).limit(1),
      "findApprovedApproval",
    ) as { id: string; task_id: string; status: ApprovalRecord["status"]; description: string; decision_note: string | null }[] | null;
    const r = rows?.[0];
    return r ? { id: r.id, taskId: r.task_id, status: r.status, description: r.description, decisionNote: r.decision_note } : null;
  }
  async consumeApproval(id: string) {
    must(await this.sb.from("approvals").update({ consumed_at: new Date().toISOString() }).eq("id", id).is("consumed_at", null), "consumeApproval");
  }
  async listWaitingTasks(ownerId?: string) {
    let q = this.sb.from("tasks").select("*").eq("status", "waiting_for_approval");
    if (ownerId) q = q.eq("owner_id", ownerId);
    const tasks = (must(await q, "listWaitingTasks") as TaskRow[] | null) ?? [];
    if (tasks.length === 0) return [];
    const approvals = (must(
      await this.sb.from("approvals").select("id, task_id, status, description, decision_note").in("task_id", tasks.map((t) => t.id)).order("created_at"),
      "listWaitingTasks(approvals)",
    ) as { id: string; task_id: string; status: ApprovalRecord["status"]; description: string; decision_note: string | null }[] | null) ?? [];
    return tasks.map((t) => ({
      task: mapTask(t),
      approvals: approvals.filter((a) => a.task_id === t.id).map((a): ApprovalRecord => ({ id: a.id, taskId: a.task_id, status: a.status, description: a.description, decisionNote: a.decision_note })),
    }));
  }

  async requeueStale() {
    const n = must(await this.sb.rpc("requeue_stale_tasks"), "requeue_stale_tasks");
    return typeof n === "number" ? n : 0;
  }

  async getSecret(ownerId: string, name: "anthropic_api_key") {
    const v = must(await this.sb.rpc("get_secret", { p_owner: ownerId, p_name: name }), "get_secret") as string | null;
    return v && v.length > 0 ? v : null;
  }

  async getConversationHistory(conversationId: string, limit: number): Promise<ChatMessageRecord[]> {
    const rows = must(
      await this.sb.from("messages").select("role, content").eq("conversation_id", conversationId).order("created_at", { ascending: false }).limit(limit),
      "getConversationHistory",
    ) as { role: string; content: string }[] | null;
    return (rows ?? []).reverse().filter((m): m is { role: "user" | "assistant"; content: string } => m.role === "user" || m.role === "assistant");
  }
  async addAssistantMessage(m: Parameters<Store["addAssistantMessage"]>[0]) {
    must(await this.sb.from("messages").insert({
      owner_id: m.ownerId, conversation_id: m.conversationId, role: "assistant", content: m.content, metadata: m.metadata ?? {},
    }), "addAssistantMessage");
  }
}
