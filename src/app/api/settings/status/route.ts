import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server/context";

/** What is configured — names and last 4 characters only, plus whether server-level secrets exist. */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const { data } = await auth.sb.from("user_secrets").select("name, last4, updated_at");
  return NextResponse.json(
    {
      secrets: ((data ?? []) as { name: string; last4: string; updated_at: string }[]).map((s) => ({ name: s.name, last4: s.last4, updatedAt: s.updated_at })),
      server: {
        // Booleans only. The service-role key is the one secret that cannot live in the database it unlocks.
        serviceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        envAnthropicFallback: !!process.env.ANTHROPIC_API_KEY,
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
