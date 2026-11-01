"use client";

import { Bell, LogOut, ShieldAlert } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { useEmployeeStore } from "@/store/employees";

/** Live company numbers. Every figure is computed from loaded database rows — none are invented. */
export function CompanyBar() {
  const mode = useEmployeeStore((s) => s.mode);
  const error = useEmployeeStore((s) => s.error);
  const email = useEmployeeStore((s) => s.userEmail);
  const employees = useEmployeeStore((s) => s.employees);
  const statuses = useEmployeeStore((s) => s.statuses);
  const tasks = useEmployeeStore((s) => s.tasks);
  const approvals = useEmployeeStore((s) => s.pendingApprovals);
  const unread = useEmployeeStore((s) => s.unreadNotifications);
  const cost = useEmployeeStore((s) => s.estimatedCostUsd);

  if (mode === "error") {
    return (
      <div role="alert" className="pointer-events-auto absolute left-1/2 top-20 z-30 w-[min(32rem,92vw)] -translate-x-1/2 rounded-xl border border-red-400/30 bg-red-950/90 p-4 text-sm text-red-100">
        <p className="font-medium">Could not load your company</p>
        <p className="mt-1 text-red-200/90">{error}</p>
        <p className="mt-2 text-xs text-red-200/70">Check that the migrations in supabase/migrations have been applied to this project.</p>
      </div>
    );
  }
  if (mode === "demo") {
    return (
      <div className="pointer-events-auto absolute left-1/2 top-4 z-20 -translate-x-1/2 rounded-full border border-amber-400/30 bg-amber-950/80 px-4 py-1.5 text-xs text-amber-100 backdrop-blur max-sm:top-20">
        Demo mode — Supabase is not configured, nothing is saved.
      </div>
    );
  }
  if (mode !== "live") return null;

  const active = employees.filter((e) => ["working", "thinking", "waiting_for_approval"].includes(statuses[e.id])).length;
  const count = (s: string) => tasks.filter((t) => t.status === s).length;
  const stat = (label: string, value: number) => (
    <div className="px-3 text-center">
      <div className="text-base font-semibold leading-tight">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
    </div>
  );

  return (
    <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center divide-x divide-white/10 rounded-xl border border-white/10 bg-slate-900/80 py-2 text-sm backdrop-blur max-sm:hidden">
      {stat("Employees", employees.length)}
      {stat("Active", active)}
      {stat("Queued", count("queued"))}
      {stat("Running", count("running") + count("waiting_for_approval"))}
      {stat("Done", count("completed"))}
      {stat("Failed", count("failed"))}
      <div className="px-3 text-center" title="Estimated from list prices and reported token usage; not an invoice">
        <div className="text-base font-semibold leading-tight">${cost.toFixed(cost < 1 ? 3 : 2)}</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">Est. AI cost</div>
      </div>
      <div className="flex items-center gap-1 px-3 text-xs" title="Pending approvals"><ShieldAlert className="h-4 w-4 text-amber-400" aria-hidden />{approvals}</div>
      <div className="flex items-center gap-1 px-3 text-xs" title="Unread notifications"><Bell className="h-4 w-4 text-amber-400" aria-hidden />{unread}</div>
      <form action={signOut} className="px-3">
        <button className="flex items-center gap-1 text-xs text-slate-300 hover:text-white" title={email ?? "Sign out"}>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </button>
      </form>
    </div>
  );
}
