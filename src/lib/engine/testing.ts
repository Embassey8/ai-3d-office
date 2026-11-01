/**
 * TEST DOUBLES ONLY — never imported by production code.
 * MemoryStore mirrors the rules enforced in SQL (supabase/migrations/…_engine_support.sql):
 * priority ordering, run_after, paused employees skipped, one running task per employee, owner scoping.
 */
import { ProviderError, type CompletionRequest, type CompletionResponse, type LLMProvider } from "@/lib/ai";
import type { EmployeeStatus } from "@/lib/employees/types";
import type {
  ApprovalRecord, ChatMessageRecord, EmployeeRecord, ExecutionPatch, LogEntry, MemoryRecord, Store, TaskRecord, ToolGrant,
} from "./store";

const PRIORITY = { urgent: 0, high: 1, normal: 2, low: 3 } as const;
let seq = 0;
export const uid = (p: string) => `${p}-${++seq}`;

export interface MemApproval extends ApprovalRecord {
  ownerId: string; employeeId: string; executionId: string; payload: Record<string, unknown>; consumed: boolean; actionType: string;
}

export class MemoryStore implements Store {
  tasks = new Map<string, TaskRecord & { runAfter: Date; result: string | null; error: string | null; lockedBy: string | null; finished: boolean }>();
  employees = new Map<string, EmployeeRecord>();
  grants = new Map<string, ToolGrant[]>();
  memories: (MemoryRecord & { employeeId: string; ownerId: string })[] = [];
  executions: { id: string; taskId: string; attempt: number; patch?: ExecutionPatch }[] = [];
  logs: LogEntry[] = [];
  notifications: { type: string; title: string; body?: string }[] = [];
  approvals: MemApproval[] = [];
  currentTask = new Map<string, string | null>();
  statusHistory: { employeeId: string; status: EmployeeStatus }[] = [];
  history = new Map<string, ChatMessageRecord[]>();
  assistantMessages: { conversationId: string; content: string }[] = [];
  clock = new Date("2026-11-01T10:00:00Z");
  /** Optional hook run at the start of every getTask call (used to simulate a CEO cancelling mid-run). */
  onGetTask?: (id: string) => void;

  addEmployee(e: Partial<EmployeeRecord> & { id: string; ownerId: string; slug: string }, grants: ToolGrant[] = []) {
    const rec: EmployeeRecord = {
      name: e.slug, title: "Tester", personality: "", systemInstructions: "You are a test employee.",
      modelProvider: "anthropic", modelName: "claude-opus-5-5", status: "idle", ...e,
    };
    this.employees.set(rec.id, rec);
    this.grants.set(rec.id, grants);
    return rec;
  }

  addTask(t: Partial<TaskRecord> & { ownerId: string; employeeId: string }) {
    const rec = {
      id: uid("task"), parentTaskId: null, title: "Do the thing", description: "", priority: "normal" as const,
      status: "queued" as const, deadline: null, attempts: 0, maxAttempts: 3, timeoutSeconds: 30, ...t,
      runAfter: new Date(0), result: null, error: null, lockedBy: null, finished: false,
    };
    this.tasks.set(rec.id, rec);
    return rec;
  }

  async claimNextTask(workerId: string, ownerId?: string) {
    const candidates = [...this.tasks.values()]
      .filter((t) => t.status === "queued" && t.runAfter <= this.clock && t.attempts < t.maxAttempts)
      .filter((t) => (ownerId ? t.ownerId === ownerId : true))
      .filter((t) => this.employees.get(t.employeeId)?.status !== "paused")
      .filter((t) => ![...this.tasks.values()].some((r) => r.employeeId === t.employeeId && r.status === "running"))
      .sort((a, b) => PRIORITY[a.priority] - PRIORITY[b.priority]);
    const t = candidates[0];
    if (!t) return null;
    t.status = "running"; t.attempts++; t.lockedBy = workerId;
    return { ...t };
  }
  async getTask(id: string) { this.onGetTask?.(id); const t = this.tasks.get(id); return t ? { ...t } : null; }
  async updateTask(id: string, patch: Parameters<Store["updateTask"]>[1]) {
    const t = this.tasks.get(id)!;
    if (patch.status) t.status = patch.status;
    if (patch.result !== undefined) t.result = patch.result;
    if (patch.error !== undefined) t.error = patch.error;
    if (patch.attempts !== undefined) t.attempts = patch.attempts;
    if (patch.runAfter) t.runAfter = patch.runAfter;
    if (patch.lockedBy !== undefined) t.lockedBy = patch.lockedBy;
    if (patch.finished) t.finished = true;
  }
  async createTask(t: Parameters<Store["createTask"]>[0]) {
    return this.addTask({ ownerId: t.ownerId, employeeId: t.employeeId, parentTaskId: t.parentTaskId, title: t.title, description: t.description, priority: t.priority }).id;
  }

  async getEmployee(id: string) { const e = this.employees.get(id); return e ? { ...e } : null; }
  async getEmployeeBySlug(ownerId: string, slug: string) {
    const e = [...this.employees.values()].find((x) => x.ownerId === ownerId && x.slug === slug);
    return e ? { ...e } : null;
  }
  async updateEmployee(id: string, patch: { status?: EmployeeStatus; currentTaskId?: string | null }) {
    const e = this.employees.get(id)!;
    if (patch.status) { e.status = patch.status; this.statusHistory.push({ employeeId: id, status: patch.status }); }
    if (patch.currentTaskId !== undefined) this.currentTask.set(id, patch.currentTaskId);
  }
  async listGrantedTools(employeeId: string) { return this.grants.get(employeeId) ?? []; }

  async listMemories(employeeId: string, limit: number) {
    return this.memories.filter((m) => m.employeeId === employeeId).sort((a, b) => b.importance - a.importance).slice(0, limit);
  }
  async addMemory(m: Parameters<Store["addMemory"]>[0]) {
    this.memories.push({ id: uid("mem"), kind: m.kind, content: m.content, importance: m.importance, employeeId: m.employeeId, ownerId: m.ownerId });
  }

  async startExecution(e: Parameters<Store["startExecution"]>[0]) {
    const attempt = this.executions.filter((x) => x.taskId === e.taskId).length + 1;
    const rec = { id: uid("exec"), taskId: e.taskId, attempt };
    this.executions.push(rec);
    return { id: rec.id, attempt };
  }
  async finishExecution(id: string, patch: ExecutionPatch) { this.executions.find((x) => x.id === id)!.patch = patch; }

  async log(entry: LogEntry) { this.logs.push(entry); }
  async notify(n: { type: string; title: string; body?: string }) { this.notifications.push(n); }

  async createApproval(a: Parameters<Store["createApproval"]>[0]) {
    const rec: MemApproval = { id: uid("appr"), taskId: a.taskId, status: "pending", description: a.description, decisionNote: null, ownerId: a.ownerId, employeeId: a.employeeId, executionId: a.executionId, payload: a.payload, consumed: false, actionType: a.actionType };
    this.approvals.push(rec);
    return rec.id;
  }
  async findApprovedApproval(taskId: string, toolSlug: string, inputHash: string) {
    return this.approvals.find((a) => a.taskId === taskId && a.status === "approved" && !a.consumed && a.payload.grant === toolSlug && a.payload.inputHash === inputHash) ?? null;
  }
  async consumeApproval(id: string) { this.approvals.find((a) => a.id === id)!.consumed = true; }
  async listWaitingTasks(ownerId?: string) {
    return [...this.tasks.values()]
      .filter((t) => t.status === "waiting_for_approval" && (!ownerId || t.ownerId === ownerId))
      .map((t) => ({ task: { ...t }, approvals: this.approvals.filter((a) => a.taskId === t.id) }));
  }
  async requeueStale() { return 0; }

  async getConversationHistory(conversationId: string, limit: number) { return (this.history.get(conversationId) ?? []).slice(-limit); }
  async addAssistantMessage(m: { conversationId: string; content: string }) {
    this.assistantMessages.push({ conversationId: m.conversationId, content: m.content });
    const h = this.history.get(m.conversationId) ?? [];
    h.push({ role: "assistant", content: m.content });
    this.history.set(m.conversationId, h);
  }
}

type Script = (req: CompletionRequest, call: number) => CompletionResponse | Promise<CompletionResponse>;

/** A scripted model. Each call is answered by the script; requests are recorded for assertions. */
export class FakeProvider implements LLMProvider {
  readonly name = "anthropic";
  requests: CompletionRequest[] = [];
  constructor(private script: Script) {}
  async complete(req: CompletionRequest) {
    this.requests.push(structuredClone({ ...req, signal: undefined }) as CompletionRequest);
    return this.script(req, this.requests.length);
  }
}

export const reply = (text: string, extra: Partial<CompletionResponse> = {}): CompletionResponse => ({
  content: [{ type: "text", text }], stopReason: "end_turn", model: "claude-opus-5-5",
  usage: { inputTokens: 1000, outputTokens: 200, cacheReadTokens: 0, cacheWriteTokens: 0 }, ...extra,
});

export const toolCall = (name: string, input: Record<string, unknown>, id = "tu_1"): CompletionResponse => ({
  content: [
    { type: "opaque", provider: "anthropic", data: { type: "thinking", thinking: "", signature: "sig-abc" } },
    { type: "tool_use", id, name, input },
  ],
  stopReason: "tool_use", model: "claude-opus-5-5",
  usage: { inputTokens: 1000, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 },
});

export const failWith = (kind: ProviderError["kind"], retryable: boolean) => () => { throw new ProviderError(`${kind} error`, kind, retryable); };
