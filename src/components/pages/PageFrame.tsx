import type { ReactNode } from "react";

export function PageFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 overflow-y-auto bg-bg">
      <div className="mx-auto flex max-w-4xl flex-col gap-5 p-5 md:p-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#9AA3B2]">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export const cardCls = "rounded-xl border border-white/[0.08] bg-surface-2";
export const monoLabel = "font-mono text-[11px] uppercase tracking-[0.12em] text-text-3";

export function LiveOnly({ mode }: { mode: string }) {
  if (mode === "live") return null;
  return (
    <p className="rounded-lg border border-amber-400/25 bg-amber-950/30 p-3 text-sm text-amber-100/90">
      {mode === "demo" ? "Demo mode: there is no data yet. Connect Supabase to see your tasks, approvals and numbers here." : "Loading…"}
    </p>
  );
}
