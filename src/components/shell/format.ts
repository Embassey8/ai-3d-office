import type { Employee, EmployeeStatus } from "@/lib/employees/types";
import type { Task } from "@/lib/data/types";
import { lookFor } from "@/lib/office/departments";

export const initial = (e: Pick<Employee, "name">) => e.name.trim()[0]?.toUpperCase() ?? "?";
export const avatarColor = (e: Pick<Employee, "slug" | "appearance">) => lookFor(e).avatar;

/** The design calls the Executive Assistant "Chief of Staff". */
export const displayRole = (e: Pick<Employee, "slug" | "title">) => (e.slug === "exec-assistant" ? "Chief of Staff" : e.title);

export const statusLine = (status: EmployeeStatus, task?: Task) =>
  status === "working" ? `Working${task ? ` · ${task.title}` : ""}`
  : status === "thinking" ? "Thinking"
  : status === "waiting_for_approval" ? "Waiting for your approval"
  : status === "paused" ? "Paused"
  : status === "error" ? "Error"
  : status === "completed" ? "Completed" : "Idle";

/** Short, stable task code like the design's "T-0187". */
export const taskCode = (id: string) => `T-${id.replace(/[^0-9a-f]/gi, "").slice(0, 4).toUpperCase().padEnd(4, "0")}`;

export const PRIORITY_STYLE: Record<Task["priority"], { label: string; bg: string; fg: string }> = {
  urgent: { label: "URGENT", bg: "#3A1A1A", fg: "#FF8A80" },
  high: { label: "HIGH", bg: "#2E2214", fg: "#FFC46B" },
  normal: { label: "MED", bg: "#1F2533", fg: "#C9D0FF" },
  low: { label: "LOW", bg: "#1C2420", fg: "#A8DCBC" },
};

export const prettyTool = (slug: string) => slug.split("_").map((w, i) => (i === 0 ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
export const empCode = (index: number) => `EMP-${String(index + 1).padStart(3, "0")}`;
