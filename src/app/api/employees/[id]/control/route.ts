import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/server/rateLimit";
import { createServiceClient, engineConfigOrResponse, requireUser, tooMany } from "@/lib/server/context";

const Body = z.object({ action: z.enum(["pause", "resume"]) });

/**
 * Pause / resume an employee. Ownership is checked with the CEO's own session (RLS); the status
 * write itself needs the service role because employee status is server-owned.
 *  - pause: the employee stops receiving work and their running task (if any) is paused.
 *  - resume: the employee becomes available again. Individually paused tasks stay paused until resumed.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Sign in first.", code: "unauthorized" }, { status: 401 });
  const limit = rateLimit(`control:${auth.user.id}`, 30, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { data: emp } = await auth.sb.from("employees").select("id, status").eq("id", id).maybeSingle();
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const cfg = engineConfigOrResponse({ needAnthropic: false });
  if ("response" in cfg) return cfg.response;
  const admin = createServiceClient(cfg.config);

  if (parsed.data.action === "pause") {
    await admin.from("employees").update({ status: "paused" }).eq("id", id).eq("owner_id", auth.user.id);
    await admin.from("tasks").update({ status: "paused" }).eq("employee_id", id).eq("owner_id", auth.user.id).eq("status", "running");
    return NextResponse.json({ status: "paused" });
  }
  if ((emp as { status: string }).status !== "paused") return NextResponse.json({ status: (emp as { status: string }).status });
  await admin.from("employees").update({ status: "idle", current_task_id: null }).eq("id", id).eq("owner_id", auth.user.id);
  return NextResponse.json({ status: "idle" });
}
