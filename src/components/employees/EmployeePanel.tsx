"use client";

import { useEffect, useState } from "react";
import { Bot, Info, Pause, Play, Settings, Send, X } from "lucide-react";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import { ALL_STATUSES, STATUS_META } from "@/lib/employees/status";
import type { EmployeeStatus } from "@/lib/employees/types";
import { useEmployeeStore } from "@/store/employees";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TabList } from "@/components/ui/tabs";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "chat", label: "Chat" },
  { id: "tasks", label: "Tasks" },
  { id: "activity", label: "Activity" },
  { id: "controls", label: "Controls" },
];

function Notice({ milestone, children }: { milestone: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/90">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
      <p>
        {children} <span className="text-amber-300">Planned for {milestone}.</span> Nothing here is simulated.
      </p>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-6 text-center text-sm text-slate-400">{children}</p>;
}

export function EmployeePanel() {
  const selectedId = useEmployeeStore((s) => s.selectedId);
  const status = useEmployeeStore((s) => (s.selectedId ? s.statuses[s.selectedId] : "idle"));
  const previewing = useEmployeeStore((s) => (s.selectedId ? !!s.previewing[s.selectedId] : false));
  const select = useEmployeeStore((s) => s.select);
  const setPreviewStatus = useEmployeeStore((s) => s.setPreviewStatus);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  const employee = SEED_EMPLOYEES.find((e) => e.id === selectedId);
  if (!employee) return null;
  const meta = STATUS_META[status];

  return (
    <aside
      aria-label={`${employee.name} profile`}
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex max-h-[72dvh] flex-col rounded-t-2xl border border-white/10 bg-slate-900/95 text-slate-100 shadow-2xl backdrop-blur sm:inset-y-4 sm:bottom-4 sm:left-auto sm:right-4 sm:max-h-none sm:w-[26rem] sm:rounded-2xl"
    >
      <header className="flex items-start gap-3 p-4">
        <div
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
          style={{ background: employee.appearance.shirt }}
          aria-hidden
        >
          {employee.name.split(" ").map((p) => p[0]).join("")}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold">{employee.name}</h2>
          <p className="truncate text-sm text-slate-300">{employee.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge color={meta.color}>{meta.label}</Badge>
            {previewing && <Badge className="text-amber-300">Demo preview</Badge>}
          </div>
        </div>
        <Button variant="ghost" className="px-2" aria-label="Close profile" onClick={() => select(null)}>
          <X className="h-4 w-4" />
        </Button>
      </header>

      <TabList tabs={TABS} value={tab} onValueChange={setTab} className="px-3" />

      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm"
      >
        {tab === "overview" && (
          <>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Department</dt>
                <dd>{employee.department}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Employee ID</dt>
                <dd className="truncate font-mono text-xs">{employee.id}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Model provider</dt>
                <dd className="capitalize">{employee.model.provider}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-400">Model</dt>
                <dd className="truncate font-mono text-xs">{employee.model.name}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs uppercase tracking-wide text-slate-400">Current assignment</dt>
                <dd className="text-slate-300">None — no task has been assigned.</dd>
              </div>
            </dl>
            <div>
              <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Personality</h3>
              <p>{employee.personality}</p>
            </div>
            <div>
              <h3 className="mb-1 text-xs uppercase tracking-wide text-slate-400">Tools</h3>
              <div className="flex flex-wrap gap-1.5">
                {employee.tools.map((t) => (
                  <Badge key={t} className="font-mono">{t}</Badge>
                ))}
              </div>
            </div>
            <details className="rounded-lg border border-white/10 p-3">
              <summary className="cursor-pointer text-xs uppercase tracking-wide text-slate-400">
                System instructions
              </summary>
              <p className="mt-2 text-slate-200">{employee.systemInstructions}</p>
            </details>
          </>
        )}

        {tab === "chat" && (
          <>
            <Notice milestone="Milestone 4">
              Chat will send your messages to {employee.name}&rsquo;s real AI model.
            </Notice>
            <Empty>No messages yet.</Empty>
            <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
              <input
                disabled
                aria-label="Message"
                placeholder={`Message ${employee.name.split(" ")[0]}…`}
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-40"
              />
              <Button type="submit" variant="primary" disabled aria-label="Send">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </>
        )}

        {tab === "tasks" && (
          <>
            <Notice milestone="Milestones 3–4">
              Assigning, prioritising, pausing and reviewing tasks needs the database and execution engine.
            </Notice>
            <Empty>No tasks in the queue.</Empty>
            <Button variant="primary" disabled className="w-full">
              Assign new task
            </Button>
          </>
        )}

        {tab === "activity" && (
          <>
            <Notice milestone="Milestone 3">
              Actions, tool usage, errors and completed work will be listed from the activity log.
            </Notice>
            <Empty>No activity recorded.</Empty>
          </>
        )}

        {tab === "controls" && (
          <>
            <Notice milestone="Milestone 4">
              Start, pause, resume and configure act on a real execution queue.
            </Notice>
            <div className="grid grid-cols-2 gap-2">
              <Button disabled><Play className="h-4 w-4" /> Start</Button>
              <Button disabled><Pause className="h-4 w-4" /> Pause</Button>
              <Button disabled><Play className="h-4 w-4" /> Resume</Button>
              <Button disabled><Settings className="h-4 w-4" /> Configure</Button>
            </div>

            <div className="rounded-lg border border-dashed border-white/15 p-3">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
                <Bot className="h-4 w-4" aria-hidden /> Demo preview
              </div>
              <p className="mb-2 text-xs text-slate-400">
                Visual test of avatar poses and status labels only. It does <strong>not</strong> run any
                task. Cleared on reload.
              </p>
              <label className="sr-only" htmlFor="preview-status">Preview status</label>
              <select
                id="preview-status"
                value={previewing ? status : ""}
                onChange={(e) =>
                  setPreviewStatus(employee.id, e.target.value ? (e.target.value as EmployeeStatus) : null)
                }
                className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm"
              >
                <option value="">Real status (idle)</option>
                {ALL_STATUSES.filter((s) => s !== "idle").map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
