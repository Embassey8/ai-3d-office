import type { EmployeeStatus } from "@/lib/employees/types";
import type { TaskPriority, TaskStatus } from "@/lib/data/types";

/** Everything the engine needs from persistence. Implemented over Supabase (service role) and in memory for tests. */
export interface TaskRecord {
  id: string;
  ownerId: string;
  employeeId: string;
  parentTaskId: string | null;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  attempts: number;
  maxAttempts: number;
  timeoutSeconds: number;
}

export interface EmployeeRecord {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  title: string;
  personality: string;
  systemInstructions: string;
  modelProvider: string;
  modelName: string;
  status: EmployeeStatus;
}

export interface ToolGrant {
  slug: string;
  name: string;
  description: string;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
}

export interface MemoryRecord {
  id: string;
  kind: "fact" | "preference" | "summary" | "lesson";
  content: string;
  importance: number;
}

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry {
  ownerId: string;
  employeeId?: string | null;
  taskId?: string | null;
  executionId?: string | null;
  eventType: string;
  level?: LogLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export type ApprovalActionType =
  | "spend_money" | "publish_advertisement" | "issue_refund" | "send_bulk_communication"
  | "place_supplier_order" | "delete_records" | "financial_commitment" | "other";

export interface ApprovalRecord {
  id: string;
  taskId: string | null;
  status: "pending" | "approved" | "rejected" | "expired";
  description: string;
  decisionNote: string | null;
}

export interface ExecutionPatch {
  status: "running" | "succeeded" | "failed" | "timed_out" | "cancelled" | "waiting_for_approval";
  output?: string | null;
  error?: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  finished?: boolean;
}

export interface ChatMessageRecord {
  role: "user" | "assistant";
  content: string;
}

export interface Store {
  claimNextTask(workerId: string, ownerId?: string): Promise<TaskRecord | null>;
  getTask(id: string): Promise<TaskRecord | null>;
  updateTask(id: string, patch: Partial<{
    status: TaskStatus; result: string | null; error: string | null; attempts: number;
    runAfter: Date; lockedBy: string | null; finished: boolean;
  }>): Promise<void>;
  createTask(t: {
    ownerId: string; employeeId: string; parentTaskId: string | null;
    title: string; description: string; priority: TaskPriority;
  }): Promise<string>;

  getEmployee(id: string): Promise<EmployeeRecord | null>;
  getEmployeeBySlug(ownerId: string, slug: string): Promise<EmployeeRecord | null>;
  updateEmployee(id: string, patch: { status?: EmployeeStatus; currentTaskId?: string | null }): Promise<void>;
  listGrantedTools(employeeId: string): Promise<ToolGrant[]>;

  listMemories(employeeId: string, limit: number): Promise<MemoryRecord[]>;
  addMemory(m: { ownerId: string; employeeId: string; kind: MemoryRecord["kind"]; content: string; importance: number; sourceTaskId?: string | null }): Promise<void>;

  startExecution(e: { ownerId: string; taskId: string; employeeId: string; workerId: string; provider: string; model: string }): Promise<{ id: string; attempt: number }>;
  finishExecution(id: string, patch: ExecutionPatch): Promise<void>;

  log(entry: LogEntry): Promise<void>;
  notify(n: {
    ownerId: string; type: "task_completed" | "task_failed" | "approval_requested" | "employee_error" | "message" | "system";
    title: string; body?: string; employeeId?: string | null; taskId?: string | null; approvalId?: string | null;
  }): Promise<void>;

  createApproval(a: {
    ownerId: string; employeeId: string; taskId: string; executionId: string;
    actionType: ApprovalActionType; description: string; payload: Record<string, unknown>;
  }): Promise<string>;
  /** An approved, not-yet-used approval for exactly this tool call. */
  findApprovedApproval(taskId: string, toolSlug: string, inputHash: string): Promise<ApprovalRecord | null>;
  consumeApproval(id: string): Promise<void>;
  /** Tasks waiting for approval together with the decisions made so far. */
  listWaitingTasks(ownerId?: string): Promise<{ task: TaskRecord; approvals: ApprovalRecord[] }[]>;

  requeueStale(): Promise<number>;

  /** Decrypted per-owner secret (e.g. the CEO's Anthropic key from Settings), or null. */
  getSecret(ownerId: string, name: "anthropic_api_key"): Promise<string | null>;

  // chat
  getConversationHistory(conversationId: string, limit: number): Promise<ChatMessageRecord[]>;
  addAssistantMessage(m: { ownerId: string; conversationId: string; content: string; metadata?: Record<string, unknown> }): Promise<void>;
}
