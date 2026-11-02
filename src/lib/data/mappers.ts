import type { Employee, ModelProvider, EmployeeStatus } from "@/lib/employees/types";
import type { ActivityEntry, ChatMessage, Task, TaskPriority, TaskStatus } from "./types";

/* Row shapes as returned by PostgREST / Realtime (snake_case). Only fields we read. */
export interface EmployeeRow {
  id: string;
  slug: string;
  name: string;
  title: string;
  personality: string;
  system_instructions: string;
  model_provider: ModelProvider;
  model_name: string;
  workstation_id: string | null;
  stand_side: number;
  appearance: Partial<Employee["appearance"]> | null;
  status: EmployeeStatus;
  current_task_id: string | null;
  departments?: { name: string } | null;
}
export interface TaskRow {
  id: string;
  employee_id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  result: string | null;
  error: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
}
export interface ActivityRow {
  id: string;
  employee_id: string | null;
  task_id: string | null;
  event_type: string;
  level: ActivityEntry["level"];
  message: string;
  created_at: string;
}
export interface MessageRow {
  id: string;
  conversation_id: string;
  role: ChatMessage["role"];
  content: string;
  metadata?: { taskIds?: unknown } | null;
  created_at: string;
}

const DEFAULT_APPEARANCE = { shirt: "#52627a", skin: "#e0b48f", hair: "#2b1d16" };

export function mapEmployee(row: EmployeeRow, toolSlugs: string[] = []): Employee {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    title: row.title,
    department: row.departments?.name ?? "—",
    workstationId: row.workstation_id,
    personality: row.personality,
    systemInstructions: row.system_instructions,
    model: { provider: row.model_provider, name: row.model_name },
    tools: toolSlugs,
    appearance: { ...DEFAULT_APPEARANCE, ...(row.appearance ?? {}) },
    standSide: row.stand_side === -1 ? -1 : 1,
    currentTaskId: row.current_task_id,
  };
}

export const mapTask = (r: TaskRow): Task => ({
  id: r.id,
  employeeId: r.employee_id,
  title: r.title,
  description: r.description,
  priority: r.priority,
  status: r.status,
  deadline: r.deadline,
  result: r.result,
  error: r.error,
  attempts: r.attempts,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const mapActivity = (r: ActivityRow): ActivityEntry => ({
  id: r.id,
  employeeId: r.employee_id,
  taskId: r.task_id,
  eventType: r.event_type,
  level: r.level,
  message: r.message,
  createdAt: r.created_at,
});

export const mapMessage = (r: MessageRow): ChatMessage => ({
  id: r.id,
  conversationId: r.conversation_id,
  role: r.role,
  content: r.content,
  taskIds: Array.isArray(r.metadata?.taskIds) ? (r.metadata!.taskIds as unknown[]).filter((x): x is string => typeof x === "string") : undefined,
  createdAt: r.created_at,
});

/** Merge a (possibly partial) Realtime employee row into an existing Employee. */
export function mergeEmployeeRow(prev: Employee, row: Partial<EmployeeRow>): Employee {
  return {
    ...prev,
    name: row.name ?? prev.name,
    title: row.title ?? prev.title,
    personality: row.personality ?? prev.personality,
    systemInstructions: row.system_instructions ?? prev.systemInstructions,
    model: {
      provider: row.model_provider ?? prev.model.provider,
      name: row.model_name ?? prev.model.name,
    },
    currentTaskId: row.current_task_id === undefined ? prev.currentTaskId : row.current_task_id,
  };
}
