import type { EmployeeStatus } from "./types";

export const STATUS_META: Record<
  EmployeeStatus,
  { label: string; color: string; description: string }
> = {
  idle: { label: "Idle", color: "#8a93a3", description: "No task running." },
  working: { label: "Working", color: "#3ddc84", description: "Executing a task." },
  thinking: { label: "Thinking", color: "#f5b841", description: "Waiting on the AI model." },
  waiting_for_approval: {
    label: "Needs approval",
    color: "#ff8a3d",
    description: "Paused until the CEO approves an action.",
  },
  paused: { label: "Paused", color: "#6c8cff", description: "Paused by the CEO." },
  completed: { label: "Completed", color: "#7ee2a8", description: "Finished the last task." },
  error: { label: "Error", color: "#ff5a5f", description: "The last task failed." },
};

export const ALL_STATUSES = Object.keys(STATUS_META) as EmployeeStatus[];

/** Statuses in which the employee is at their desk. */
const AT_DESK: ReadonlySet<EmployeeStatus> = new Set([
  "working",
  "thinking",
  "waiting_for_approval",
  "paused",
  "error",
]);

export const isAtDesk = (s: EmployeeStatus) => AT_DESK.has(s);

/** Only a real running task should produce the typing animation. */
export const isTyping = (s: EmployeeStatus) => s === "working";

/** Monitor shows content only while the employee is actively engaged with it. */
export const screenIsOn = (s: EmployeeStatus) =>
  s === "working" || s === "thinking" || s === "waiting_for_approval";
