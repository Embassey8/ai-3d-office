import { after, NextResponse } from "next/server";
import { z } from "zod";
import { ProviderError } from "@/lib/ai";
import { replyToChat } from "@/lib/engine/chat";
import { processQueue } from "@/lib/engine/queue";
import { rateLimit } from "@/lib/server/rateLimit";
import { createEngineDeps, engineConfigOrResponse, missingKeyResponse, requireUser, tooMany } from "@/lib/server/context";

export const maxDuration = 120;

const Body = z.object({ employeeId: z.string().uuid(), message: z.string().trim().min(1).max(8000) });

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Sign in first.", code: "unauthorized" }, { status: 401 });
  const { sb, user } = auth;

  const limit = rateLimit(`chat:${user.id}`, 20, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { employeeId, message } = parsed.data;

  // Check configuration BEFORE saving anything, so a misconfigured server never leaves unanswered messages.
  const cfg = engineConfigOrResponse();
  if ("response" in cfg) return cfg.response;
  const noKey = await missingKeyResponse(cfg.config, user.id);
  if (noKey) return noKey;

  // Ownership is enforced by RLS: another CEO's employee simply isn't visible.
  const { data: emp } = await sb.from("employees").select("id").eq("id", employeeId).maybeSingle();
  if (!emp) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  let { data: conv } = await sb.from("conversations").select("id").eq("employee_id", employeeId).order("created_at").limit(1).maybeSingle();
  if (!conv) {
    const created = await sb.from("conversations").insert({ owner_id: user.id, employee_id: employeeId }).select("id").single();
    if (created.error) return NextResponse.json({ error: "Could not start the conversation." }, { status: 500 });
    conv = created.data;
  }
  const conversationId = (conv as { id: string }).id;

  const saved = await sb.from("messages").insert({ owner_id: user.id, conversation_id: conversationId, role: "user", content: message });
  if (saved.error) return NextResponse.json({ error: "Could not save your message." }, { status: 500 });

  try {
    const deps = createEngineDeps(cfg.config, "chat");
    const provider = await deps.getProvider("anthropic", user.id);
    const out = await replyToChat({ store: deps.store, provider }, { ownerId: user.id, employeeId, conversationId });
    // Tasks the employee created from this message start running right away, in the background.
    if (out.createdTaskIds.length) {
      after(async () => {
        try { await processQueue(deps, { ownerId: user.id, maxTasks: 5, budgetMs: 200_000 }); }
        catch (e) { console.error("[chat] background run failed:", e instanceof Error ? e.message : e); }
      });
    }
    return NextResponse.json({ conversationId, reply: out.reply, createdTasks: out.createdTaskIds.length });
  } catch (e) {
    const pe = e instanceof ProviderError ? e : new ProviderError(e instanceof Error ? e.message : String(e), "unknown", false);
    // The CEO's message is saved; the reply failed. Say so plainly.
    return NextResponse.json({ conversationId, error: `The employee could not reply: ${pe.message}`, code: pe.kind, retryable: pe.retryable }, { status: pe.kind === "rate_limit" ? 429 : 502 });
  }
}
