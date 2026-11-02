"use client";

import { useMemo, useState } from "react";
import { canDo } from "@/lib/data/schemas";
import { changeTaskStatus } from "@/lib/data/company";
import type { Task } from "@/lib/data/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { avatarColor, initial, PRIORITY_STYLE, taskCode } from "@/components/shell/format";
import { cn } from "@/lib/utils";
import { cardCls, LiveOnly, PageFrame } from "./PageFrame";

const FILTERS = [
  { id: "open", label: "Open", test: (t: Task) => ["queued", "running", "waiting_for_approval", "paused"].includes(t.status) },
  { id: "done", label: "Completed", test: (t: Task) => t.status === "completed" },
  { id: "failed", label: "Failed", test: (t: Task) => t.status === "failed" || t.status === "cancelled" },
  { id: "all", label: "All", test: () => true },
] as const;

const STATUS_COLOR: Record<Task["status"], string> = {
  queued: "#8A93A3", running: "#3DDC84", waiting_for_approval: "#FF8A3D", paused: "#6C8CFF", completed: "#7EE2A8", failed: "#FF5A5F", cancelled: "#6B7280",
};

export function TasksPage() {
  const mode = useEmployeeStore((s) => s.mode);
  const tasks = useEmployeeStore((s) => s.tasks);
  const employees = useEmployeeStore((s) => s.employees);
  const select = useEmployeeStore((s) => s.select);
  const setTab = useUiStore((s) => s.setTab);
  const setActive = useUiStore((s) => s.setActiveChat);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open");
  const [err, setErr] = useState<string | null>(null);

  const active = FILTERS.find((f) => f.id === filter)!;
  const rows = useMemo(() => tasks.filter(active.test).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [tasks, active]);

  const act = async (t: Task, a: "pause" | "resume" | "cancel") => {
    const sb = getBrowserClient();
    if (!sb) return;
    setErr(null);
    try { await changeTaskStatus(sb, t, a); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <PageFrame title="Tasks" subtitle="Everything your employees are working on, queued, or have finished.">
      <LiveOnly mode={mode} />
      <div role="tablist" aria-label="Task filter" className="flex w-fit gap-0.5 rounded-[10px] border border-white/[0.06] bg-surface-3 p-[3px]">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
            className={cn("rounded-[7px] px-3.5 py-[7px] text-[13px]", filter === f.id ? "bg-bubble-me font-medium text-white" : "text-text-2")}>
            {f.label} <span className="ml-1 font-mono text-[11px] text-text-3">{tasks.filter(f.test).length}</span>
          </button>
        ))}
      </div>
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      {mode === "live" && rows.length === 0 && <p className={cn(cardCls, "p-8 text-center text-sm text-text-3")}>No tasks here yet. Ask Ada in the chat to get something done.</p>}
      <ul className="flex flex-col gap-2">
        {rows.map((t) => {
          const e = employees.find((x) => x.id === t.employeeId);
          const p = PRIORITY_STYLE[t.priority];
          return (
            <li key={t.id} className={cn(cardCls, "flex flex-wrap items-center gap-3 p-3.5")}>
              <span className="font-mono text-[11px] text-text-3">{taskCode(t.id)}</span>
              <span className="rounded-[5px] px-[7px] py-0.5 font-mono text-[10px]" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
              <div className="min-w-[160px] flex-1">
                <div className="font-medium">{t.title}</div>
                {t.error && <div className="mt-0.5 text-xs text-red-300">{t.error}</div>}
                {t.status === "completed" && t.result && <div className="mt-0.5 line-clamp-2 text-xs text-[#9AA3B2]">{t.result}</div>}
              </div>
              {e && (
                <button onClick={() => { setActive(e.id); select(e.id); setTab("office"); }} className="flex items-center gap-2 text-xs text-text-2 hover:text-white">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[#0B0D12]" style={{ background: avatarColor(e) }}>{initial(e)}</span>{e.name}
                </button>
              )}
              <span className="flex w-36 items-center gap-1.5 text-xs" style={{ color: STATUS_COLOR[t.status] }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[t.status] }} />{t.status.replace(/_/g, " ")}
              </span>
              <div className="flex gap-1.5">
                {canDo("pause", t.status) && <button onClick={() => act(t, "pause")} className="h-7 rounded-md border border-white/[0.12] px-2.5 text-xs text-[#DDE1E8]">Pause</button>}
                {canDo("resume", t.status) && <button onClick={() => act(t, "resume")} className="h-7 rounded-md border border-white/[0.12] px-2.5 text-xs text-[#DDE1E8]">Resume</button>}
                {canDo("cancel", t.status) && <button onClick={() => act(t, "cancel")} className="h-7 rounded-md px-2.5 text-xs text-text-3 hover:text-white">Cancel</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </PageFrame>
  );
}
