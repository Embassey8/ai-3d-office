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
  /** Stable key shared with the database (e.g. "seo"). */
  slug: string;
  name: string;
  title: string;
  department: string;
  /** Legacy desk id from the previous office layout. Unused by the new scene; kept for DB compatibility. */
  workstationId: string | null;
  personality: string;
  systemInstructions: string;
  model: { provider: ModelProvider; name: string };
  /** Tool slugs this employee may use. Enforced server-side from Milestone 4. */
  tools: string[];
  appearance: { shirt: string; skin: string; hair: string; /** Avatar tile / chat colour. */ avatar?: string };
  currentTaskId?: string | null;
  /** Local x offset of the standing spot relative to the desk (default +1.3). */
  standSide?: 1 | -1;
}
