/**
 * MOCK DATA — demo mode only (Supabase not configured). This is a sample conversation copied from the
 * design so the layout can be seen without a backend. It is shown with a visible "sample" notice and is
 * never used when signed in.
 */
export interface DemoItem {
  kind: "me" | "agent" | "approval" | "task" | "time";
  text?: string;
  title?: string;
  meta?: string;
  taskId?: string;
  priority?: "HIGH" | "MED" | "LOW";
  assignee?: string;
  progress?: number;
}

export const DEMO_THREAD_ADA: DemoItem[] = [
  { kind: "time", text: "SAMPLE CONVERSATION" },
  { kind: "me", text: "Morning Ada. What needs me today?" },
  { kind: "agent", text: "Three things. Zara has LinkedIn posts waiting for your sign-off, Kai pushed the pricing fix to staging, and Iris finished the competitor pricing scan." },
  { kind: "approval", title: "Publish 3 posts to LinkedIn", meta: "Zara · Social Media Manager · scheduled Tue 09:00" },
  { kind: "me", text: "Approved. Get Femi to turn Iris's scan into a blog brief." },
  { kind: "agent", text: "Done — assigned to Femi with Iris's scan attached from the Brain." },
  { kind: "task", taskId: "T-0187", title: "Blog brief from competitor pricing scan", priority: "HIGH", assignee: "Femi · SEO Specialist", progress: 18 },
];
