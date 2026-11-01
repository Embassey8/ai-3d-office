import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in — Embassey AI Headquarters" };

export default function LoginPage() {
  // Without Supabase there is nothing to sign in to: go straight to the demo office.
  if (!isSupabaseConfigured()) redirect("/");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-slate-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="text-xs uppercase tracking-[0.35em] text-amber-400">Embassey</div>
          <h1 className="mt-2 text-2xl font-semibold">AI Headquarters</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in as CEO to enter your office.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
