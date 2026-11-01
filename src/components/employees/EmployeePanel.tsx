"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { STATUS_META } from "@/lib/employees/status";
import { modelFamily } from "@/lib/office/departments";
import { effectiveStatus, useEmployeeStore } from "@/store/employees";
import { avatarColor, displayRole, empCode, initial, PRIORITY_STYLE, prettyTool } from "@/components/shell/format";
import { cn } from "@/lib/utils";
import { ActivityTab } from "./ActivityTab";
import { ControlsTab } from "./ControlsTab";
import { TasksTab } from "./TasksTab";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
];
const mono = "font-mono";
const label = cn(mono, "text-[11px] tracking-[0.12em] text-text-3");

/** Right-hand employee panel (design: Office.dc.html). Docked, not an overlay. */
export function EmployeePanel() {
  const selectedId = useEmployeeStore((s) => s.selectedId);
  const select = useEmployeeStore((s) => s.select);
  const employees = useEmployeeStore((s) => s.employees);
  const statuses = useEmployeeStore((s) => s.statuses);
  const previews = useEmployeeStore((s) => s.previews);
  const tasks = useEmployeeStore((s) => s.tasks);
  const mode = useEmployeeStore((s) => s.mode);
  const memoryBy = useEmployeeStore((s) => s.memoryByEmployee);
  const costBy = useEmployeeStore((s) => s.costTodayByEmployee);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  const idx = employees.findIndex((e) => e.id === selectedId);
  const employee = employees[idx];
  if (!employee) return null;
  const status = effectiveStatus({ statuses, previews }, employee.id);
  const meta = STATUS_META[status];
  const previewing = previews[employee.id] !== undefined;
  const current = tasks.find((t) => t.id === employee.currentTaskId);
  const queue = tasks.filter((t) => t.employeeId === employee.id && (t.status === "queued" || t.status === "paused"));
  const live = mode === "live";
  const fact = (k: string, v: React.ReactNode, m = false) => (
    <div className="rounded-[10px] bg-surface-3 px-3 py-2.5"><div className="text-[11px] text-text-3">{k}</div><div className={cn("mt-0.5 text-[13px]", m ? mono : "font-medium")}>{v}</div></div>
  );

  return (
    <aside aria-label={`${employee.name} profile`} className="flex min-h-[420px] min-w-0 flex-col overflow-y-auto border-t border-[var(--border)] bg-surface-2 lg:min-h-0 lg:border-l lg:border-t-0">
      <div className="flex items-start gap-3 border-b border-white/[0.06] p-4">
        <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] text-lg font-bold text-[#0B0D12]" style={{ background: avatarColor(employee) }} aria-hidden>{initial(employee)}</div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-semibold">{employee.name}</h2>
          <div className="text-[13px] text-[#9AA3B2]">{displayRole(employee)} · {employee.department}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-md px-[9px] py-[3px] text-xs" style={{ background: `${meta.color}22`, color: meta.color }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}</span>
            {previewing && <span className="rounded-md bg-amber-500/15 px-2 py-[3px] text-xs text-amber-300">Demo preview</span>}
          </div>
        </div>
        <button aria-label="Close profile" onClick={() => select(null)} className="flex h-8 w-8 items-center justify-center rounded-lg text-text-2 hover:bg-surface-3"><X className="h-4 w-4" /></button>
      </div>

      <div role="tablist" aria-label="Profile sections" className="flex gap-0.5 overflow-x-auto border-b border-white/[0.06] px-3 py-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)}
            className={cn("rounded-[7px] px-2.5 py-[7px] text-[13px]", tab === t.id ? "bg-bubble-me text-white" : "text-text-2 hover:text-white")}>{t.label}</button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="flex flex-col gap-4 p-4 text-sm">
        {tab === "overview" && (
          <>
            <section className="flex flex-col gap-2">
              <div className={label}>CURRENT ASSIGNMENT</div>
              <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-surface-3 p-3">
                <div className="font-medium">{current?.title ?? "Nothing running"}</div>
                <div className="text-xs text-[#9AA3B2]">{current ? `${current.status.replace(/_/g, " ")} · attempt ${current.attempts}` : "No task is running, so this employee is " + meta.label.toLowerCase() + "."}</div>
              </div>
            </section>
            <section className="grid grid-cols-2 gap-2">
              {fact("Model", `Claude ${modelFamily(employee.model.name)}`)}
              {fact("Employee ID", empCode(idx), true)}
              {fact("Memory", live ? `${memoryBy[employee.id] ?? 0} notes` : "—")}
              {fact("AI cost today", live ? `$${(costBy[employee.id] ?? 0).toFixed(3)}` : "—")}
            </section>
            <section className="flex flex-col gap-2">
              <div className={label}>TOOLS · AUTHORIZED</div>
              <div className="flex flex-wrap gap-1.5">{employee.tools.map((t) => <span key={t} className="rounded-[7px] border border-white/[0.08] bg-surface-4 px-[9px] py-1 text-xs">{prettyTool(t)}</span>)}</div>
            </section>
            <section className="flex flex-col gap-2">
              <div className={label}>QUEUE · {queue.length}</div>
              {queue.length === 0 && <p className="text-xs text-text-3">Nothing queued.</p>}
              {queue.map((t) => {
                const p = PRIORITY_STYLE[t.priority];
                return (
                  <div key={t.id} className="flex items-center gap-2.5 rounded-[10px] bg-surface-3 px-3 py-2.5">
                    <span className={cn(mono, "rounded-[5px] px-1.5 py-0.5 text-[10px]")} style={{ background: p.bg, color: p.fg }}>{p.label}</span>
                    <span className="flex-1 truncate text-[13px]">{t.title}</span>
                    <span className="text-xs text-text-3">{t.status === "paused" ? "Paused" : t.deadline ? new Date(t.deadline).toLocaleDateString(undefined, { weekday: "short" }) : ""}</span>
                  </div>
                );
              })}
            </section>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab("settings")} className="h-[38px] flex-1 basis-20 rounded-[9px] border border-white/[0.12] bg-surface-3 text-[13px] text-[#E3E6EC]">Pause</button>
              <button onClick={() => setTab("settings")} className="h-[38px] flex-1 basis-20 rounded-[9px] border border-white/[0.12] bg-surface-3 text-[13px] text-[#E3E6EC]">Configure</button>
              <button onClick={() => setTab("tasks")} className="h-[38px] flex-[2] basis-28 rounded-[9px] bg-primary text-[13px] font-semibold text-white">Assign task</button>
            </div>
          </>
        )}
        {tab === "tasks" && <TasksTab employee={employee} />}
        {tab === "activity" && <ActivityTab employee={employee} />}
        {tab === "settings" && <ControlsTab employee={employee} />}
      </div>
    </aside>
  );
}
