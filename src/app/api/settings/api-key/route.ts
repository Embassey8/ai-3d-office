import { NextResponse } from "next/server";
import { z } from "zod";
import { AnthropicKeySchema, verifyAnthropicKey } from "@/lib/server/anthropicKey";
import { rateLimit } from "@/lib/server/rateLimit";
import { requireUser, tooMany } from "@/lib/server/context";

export const maxDuration = 30;
const noStore = { "Cache-Control": "no-store" };

const Body = z.object({ name: z.literal("anthropic_api_key"), value: AnthropicKeySchema });

/**
 * Save the signed-in CEO's Anthropic API key.
 * The value is verified with Anthropic, then written to Supabase Vault through a SECURITY DEFINER
 * function using the CEO's own session — so this works without the service-role key. The value is
 * never returned, logged or stored anywhere else.
 */
export async function PUT(req: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Sign in first.", code: "unauthorized" }, { status: 401, headers: noStore });
  const limit = rateLimit(`secret:${auth.user.id}`, 10, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400, headers: noStore });

  const check = await verifyAnthropicKey(parsed.data.value);
  if (!check.ok && check.reason === "rejected") return NextResponse.json({ error: check.message, code: "key_rejected" }, { status: 400, headers: noStore });

  const { error } = await auth.sb.rpc("set_my_secret", { p_name: parsed.data.name, p_value: parsed.data.value });
  if (error) return NextResponse.json({ error: "Could not save the key. Make sure the latest database migrations have been applied." }, { status: 500, headers: noStore });

  return NextResponse.json(
    { saved: true, last4: parsed.data.value.slice(-4), verified: check.ok, ...(check.ok ? {} : { warning: `${check.message} The key was saved but not verified.` }) },
    { headers: noStore },
  );
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Sign in first.", code: "unauthorized" }, { status: 401, headers: noStore });
  const limit = rateLimit(`secret:${auth.user.id}`, 10, 60_000);
  if (!limit.ok) return tooMany(limit.retryAfterSec);
  const name = new URL(req.url).searchParams.get("name");
  if (name !== "anthropic_api_key") return NextResponse.json({ error: "Unknown key." }, { status: 400, headers: noStore });
  const { error } = await auth.sb.rpc("delete_my_secret", { p_name: name });
  if (error) return NextResponse.json({ error: "Could not remove the key." }, { status: 500, headers: noStore });
  return NextResponse.json({ removed: true }, { headers: noStore });
}
