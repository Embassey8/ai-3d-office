import { z } from "zod";

/** Validates what the CEO types before it is sent to the database. The DB re-validates (checks, RLS). */
export const NewTaskSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().trim().min(1, "Give the task a title.").max(200, "Title is too long (200 max)."),
  description: z.string().trim().max(20000).default(""),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  deadline: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), "Deadline is not a valid date.")
    .default(null),
});
export type NewTaskInput = z.input<typeof NewTaskSchema>;

export const EmployeeConfigSchema = z.object({
  personality: z.string().trim().max(2000),
  systemInstructions: z.string().trim().min(1, "Instructions cannot be empty.").max(20000),
  modelName: z.string().trim().min(1).max(100),
});

/** Which task status changes the CEO may request (mirrors guard_task_update in the DB). */
export const CEO_TASK_ACTIONS = {
  pause: { from: ["queued", "running"], to: "paused" },
  resume: { from: ["paused"], to: "queued" },
  cancel: { from: ["queued", "paused", "running", "waiting_for_approval"], to: "cancelled" },
} as const;
export type CeoTaskAction = keyof typeof CEO_TASK_ACTIONS;

export const canDo = (action: CeoTaskAction, status: string) =>
  (CEO_TASK_ACTIONS[action].from as readonly string[]).includes(status);

export const isEditable = (status: string) => status === "queued" || status === "paused";
