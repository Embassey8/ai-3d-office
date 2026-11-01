export type EmployeeStatus =
  | "idle"
  | "working"
  | "thinking"
  | "waiting_for_approval"
  | "paused"
  | "completed"
  | "error";

export type ModelProvider = "anthropic" | "openai" | "google" | "local";

export interface Employee {
  id: string;
  name: string;
  title: string;
  department: string;
  /** Furniture id of the workstation this employee sits at (see layout.ts). */
  workstationId: string;
  personality: string;
  systemInstructions: string;
  model: { provider: ModelProvider; name: string };
  /** Tool slugs this employee may use. Enforced server-side from Milestone 4. */
  tools: string[];
  appearance: { shirt: string; skin: string; hair: string };
  /** Local x offset of the standing spot relative to the desk (default +1.3). */
  standSide?: 1 | -1;
}
