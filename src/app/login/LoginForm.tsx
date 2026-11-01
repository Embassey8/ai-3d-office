"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signIn, signUp, type AuthState } from "./actions";

const field =
  "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus-visible:border-amber-400";

export function LoginForm() {
  const [inState, inAction, inPending] = useActionState<AuthState, FormData>(signIn, {});
  const [upState, upAction, upPending] = useActionState<AuthState, FormData>(signUp, {});
  const state = upState.error || upState.message ? upState : inState;
  const pending = inPending || upPending;

  return (
    <form className="space-y-4 rounded-2xl border border-white/10 bg-slate-900/70 p-6">
      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm text-slate-300">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={field} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm text-slate-300">Password</label>
        <input
          id="password" name="password" type="password" minLength={8}
          autoComplete="current-password" required className={field}
        />
      </div>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      {state.message && <p role="status" className="text-sm text-emerald-400">{state.message}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Button type="submit" variant="primary" formAction={inAction} disabled={pending}>Sign in</Button>
        <Button type="submit" formAction={upAction} disabled={pending}>Create account</Button>
      </div>
    </form>
  );
}
