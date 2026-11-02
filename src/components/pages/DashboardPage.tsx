"use client";

import { useMemo } from "react";
import { useEmployeeStore } from "@/store/employees";
import { avatarColor, initial } from "@/components/shell/format";
import { cn } from "@/lib/utils";
import { cardCls, LiveOnly, monoLabel, PageFrame } from "./PageFrame";

/** Every number here is computed from loaded database rows — nothing is hardcoded or sampled. */
export function DashboardPage() {
  const mode = useEmployeeStore((s) => s.mode);
  const employees = useEmployeeStore((s) => s.employees);
  const statuses = useEmployeeStore((s) => s.statuses);
  const tasks = useEmployeeStore((s) => s.tasks);
  const approvals = useEmployeeStore((s) => s.pendingApprovals);
  const cost = useEmployeeStore((s) => s.estimatedCostUsd);
  const activity = useEmployeeStore((s) => s.activity);
  const live = mode === "live";

  const active = employees.filter((e) => ["working", "thinking", "waiting_for_approval"].includes(statuses[e.id])).length;
  const count = (...s: string[]) => tasks.filter((t) => s.includes(t.status)).length;

  const byDept = useMemo(() => {
    const m = new Map<string, { name: string; done: number; failed: number; open: number }>();
    for (const e of employees) if (!m.has(e.department)) m.set(e.department, { name: e.department, done: 0, failed: 0, open: 0 });
    for (const t of tasks) {
      const dept = employees.find((e) => e.id === t.employeeId)?.department;
      const row = dept ? m.get(dept) : undefined;
      if (!row) continue;
      if (t.status === "completed") row.done++;
      else if (t.status === "failed") row.failed++;
      else if (["queued", "running", "waiting_for_approval", "paused"].includes(t.status)) row.open++;
    }
    return [...m.values()];
  }, [employees, tasks]);

  const stat = (label: string, value: string | number, hint?: string, tone = "text-white") => (
    <div className={cn(cardCls, "p-4")}><div className={monoLabel}>{label}</div><div className={cn("mt-1.5 text-2xl font-semibold tracking-tight", tone)}>{value}</div>{hint && <div className="mt-0.5 text-xs text-text-3">{hint}</div>}</div>
  );

  return (
    <PageFrame title="Dashboard" subtitle="How the company is doing, from your real data.">
      <LiveOnly mode={mode} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat("Employees", employees.length, `${active} active now`)}
        {stat("In progress", live ? count("running", "waiting_for_approval") : "—")}
        {stat("Queued", live ? count("queued", "paused") : "—")}
        {stat("Completed", live ? count("completed") : "—", undefined, "text-[#7EE2A8]")}
        {stat("Failed", live ? count("failed") : "—", undefined, count("failed") ? "text-[#FF8A80]" : "text-white")}
        {stat("Pending approvals", live ? approvals : "—", undefined, approvals ? "text-[#FFB27A]" : "text-white")}
        {stat("AI cost (est.)", live ? `$${cost.toFixed(cost < 1 ? 3 : 2)}` : "—", "From list prices and reported tokens; not an invoice")}
      </div>

      <section className={cn(cardCls, "p-4")}>
        <h2 className={monoLabel}>Department performance</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {byDept.map((d) => {
            const total = d.done + d.failed + d.open;
            return (
              <li key={d.name} className="flex items-center gap-3 text-sm">
                <span className="w-36 truncate">{d.name}</span>
                <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-[#232838]" aria-hidden>
                  {total > 0 && <><span style={{ width: `${(d.done / total) * 100}%` }} className="bg-[#3DDC84]" /><span style={{ width: `${(d.open / total) * 100}%` }} className="bg-[#6C8CFF]" /><span style={{ width: `${(d.failed / total) * 100}%` }} className="bg-[#FF5A5F]" /></>}
                </div>
                <span className="w-44 text-right font-mono text-xs text-text-3">{live ? `${d.done} done · ${d.open} open · ${d.failed} failed` : "—"}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={cn(cardCls, "p-4")}>
        <h2 className={monoLabel}>Recent activity</h2>
        {live && activity.length === 0 && <p className="mt-3 text-sm text-text-3">Nothing has happened yet.</p>}
        <ul className="mt-3 flex flex-col divide-y divide-white/[0.06]">
          {activity.slice(0, 12).map((a) => {
            const e = employees.find((x) => x.id === a.employeeId);
            return (
              <li key={a.id} className="flex items-start gap-3 py-2.5 text-sm">
                {e ? <span className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[10px] font-bold text-[#0B0D12]" style={{ background: avatarColor(e) }}>{initial(e)}</span> : <span className="h-5 w-5" />}
                <div className="min-w-0 flex-1"><div className={a.level === "error" ? "text-[#FF8A80]" : "text-[#DDE1E8]"}>{a.message}</div><div className="font-mono text-[11px] text-text-3">{a.eventType} · {new Date(a.createdAt).toLocaleString()}</div></div>
              </li>
            );
          })}
        </ul>
      </section>
    </PageFrame>
  );
}
