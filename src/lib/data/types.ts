import type { EmployeeStatus } from "@/lib/employees/types";

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface Task {
  id: string;
  employeeId: string;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline: string | null;
  result: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityEntry {
  id: string;
  employeeId: string | null;
  taskId: string | null;
  eventType: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  employeeId: string;
}

export type EmployeeStatusMap = Record<string, EmployeeStatus>;

export interface PendingApproval {
  id: string;
  employeeId: string;
  taskId: string | null;
  actionType: string;
  description: string;
  createdAt: string;
}
