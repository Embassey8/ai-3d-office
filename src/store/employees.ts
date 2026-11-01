import { create } from "zustand";
import type { Employee, EmployeeStatus } from "@/lib/employees/types";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import type { ActivityEntry, ChatMessage, Conversation, PendingApproval, Task } from "@/lib/data/types";
import { mergeEmployeeRow, type EmployeeRow } from "@/lib/data/mappers";

export type DataMode = "loading" | "demo" | "live" | "error";

interface CompanyState {
  mode: DataMode;
  error: string | null;
  userEmail: string | null;
  employees: Employee[];
  /** Real status per employee (from the database in live mode). */
  statuses: Record<string, EmployeeStatus>;
  /** Local-only visual preview of a status. Never persisted, never starts a task. */
  previews: Record<string, EmployeeStatus>;
  tasks: Task[];
  activity: ActivityEntry[];
  conversations: Conversation[];
  messages: Record<string, ChatMessage[]>;
  pendingApprovals: number;
  /** Shared-memory notes (rows in employee_memories), shown on the Brain label. null = unknown (demo). */
  memoryCount: number | null;
  memoryByEmployee: Record<string, number>;
  costTodayByEmployee: Record<string, number>;
  approvals: PendingApproval[];
  unreadNotifications: number;
  /** Sum of task_executions.cost_usd — an ESTIMATE from list prices. */
  estimatedCostUsd: number;
  selectedId: string | null;
  /** World point the third-person camera should look at (set when an employee is selected). */
  focus: { x: number; z: number } | null;

  select: (id: string | null) => void;
  clearFocus: () => void;
  setPreviewStatus: (id: string, status: EmployeeStatus | null) => void;

  initDemo: () => void;
  setLoading: () => void;
  setError: (message: string) => void;
  setLive: (data: {
    userEmail: string | null;
    employees: Employee[];
    statuses: Record<string, EmployeeStatus>;
    tasks: Task[];
    activity: ActivityEntry[];
    conversations: Conversation[];
    pendingApprovals: number;
    approvals: PendingApproval[];
    unreadNotifications: number;
    estimatedCostUsd: number;
    memoryCount: number | null;
    memoryByEmployee: Record<string, number>;
    costTodayByEmployee: Record<string, number>;
  }) => void;
  applyEmployeeRow: (row: Partial<EmployeeRow> & { id: string }) => void;
  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
  addActivity: (entry: ActivityEntry) => void;
  setMessages: (conversationId: string, msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  addConversation: (c: Conversation) => void;
  setCounts: (c: { pendingApprovals: number; unreadNotifications: number }) => void;
  setCost: (usd: number) => void;
  setApprovals: (a: PendingApproval[]) => void;
}

const MAX_TASKS = 500;
const MAX_ACTIVITY = 500;

export const useEmployeeStore = create<CompanyState>((set) => ({
  mode: "loading",
  error: null,
  userEmail: null,
  employees: [],
  statuses: {},
  previews: {},
  tasks: [],
  activity: [],
  conversations: [],
  messages: {},
  pendingApprovals: 0,
  memoryCount: null,
  memoryByEmployee: {},
  costTodayByEmployee: {},
  approvals: [],
  unreadNotifications: 0,
  estimatedCostUsd: 0,
  selectedId: null,
  focus: null,

  select: (id) => set({ selectedId: id, focus: null }),
  clearFocus: () => set({ focus: null }),
  setPreviewStatus: (id, status) =>
    set((s) => {
      const previews = { ...s.previews };
      if (status) previews[id] = status;
      else delete previews[id];
      return { previews };
    }),

  initDemo: () =>
    set({
      mode: "demo",
      error: null,
      userEmail: null,
      employees: [...SEED_EMPLOYEES],
      statuses: Object.fromEntries(SEED_EMPLOYEES.map((e) => [e.id, "idle" as EmployeeStatus])),
      tasks: [],
      activity: [],
    }),
  setLoading: () => set({ mode: "loading", error: null }),
  setError: (error) => set({ mode: "error", error }),
  setLive: (d) => set({ mode: "live", error: null, ...d }),

  applyEmployeeRow: (row) =>
    set((s) => ({
      employees: s.employees.map((e) => (e.id === row.id ? mergeEmployeeRow(e, row) : e)),
      statuses: row.status ? { ...s.statuses, [row.id]: row.status } : s.statuses,
    })),
  upsertTask: (task) =>
    set((s) => {
      const i = s.tasks.findIndex((t) => t.id === task.id);
      if (i === -1) return { tasks: [task, ...s.tasks].slice(0, MAX_TASKS) };
      const tasks = s.tasks.slice();
      tasks[i] = task;
      return { tasks };
    }),
  removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
  addActivity: (entry) =>
    set((s) =>
      s.activity.some((a) => a.id === entry.id)
        ? s
        : { activity: [entry, ...s.activity].slice(0, MAX_ACTIVITY) },
    ),
  setMessages: (conversationId, msgs) =>
    set((s) => ({ messages: { ...s.messages, [conversationId]: msgs } })),
  addMessage: (msg) =>
    set((s) => {
      const list = s.messages[msg.conversationId];
      if (!list || list.some((m) => m.id === msg.id)) return s;
      return { messages: { ...s.messages, [msg.conversationId]: [...list, msg] } };
    }),
  addConversation: (c) =>
    set((s) => (s.conversations.some((x) => x.id === c.id) ? s : { conversations: [...s.conversations, c] })),
  setCounts: ({ pendingApprovals, unreadNotifications }) => set({ pendingApprovals, unreadNotifications }),
  setCost: (estimatedCostUsd) => set({ estimatedCostUsd }),
  setApprovals: (approvals) => set({ approvals, pendingApprovals: approvals.length }),
}));

/** The status the UI should show: a local preview if one is set, otherwise the real status. */
export const effectiveStatus = (
  s: Pick<CompanyState, "statuses" | "previews">,
  id: string,
): EmployeeStatus => s.previews[id] ?? s.statuses[id] ?? "idle";
