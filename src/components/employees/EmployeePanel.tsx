"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { STATUS_META } from "@/lib/employees/status";
import { effectiveStatus, useEmployeeStore } from "@/store/employees";
import { ActivityTab } from "./ActivityTab";
import { ChatTab } from "./ChatTab";
import { ControlsTab } from "./ControlsTab";
import { TasksTab } from "./TasksTab";
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

export function EmployeePanel() {
  const selectedId = useEmployeeStore((s) => s.selectedId);
  const status = useEmployeeStore((s) => (s.selectedId ? effectiveStatus(s, s.selectedId) : "idle"));
  const previewing = useEmployeeStore((s) => (s.selectedId ? s.previews[s.selectedId] !== undefined : false));
  const employees = useEmployeeStore((s) => s.employees);
  const tasks = useEmployeeStore((s) => s.tasks);
  const select = useEmployeeStore((s) => s.select);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && select(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, select]);

  const employee = employees.find((e) => e.id === selectedId);
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
                <dd className="text-slate-300">{tasks.find((t) => t.id === employee.currentTaskId)?.title ?? "None — no task is running."}</dd>
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

        {tab === "chat" && <ChatTab employee={employee} />}
        {tab === "tasks" && <TasksTab employee={employee} />}
        {tab === "activity" && <ActivityTab employee={employee} />}
        {tab === "controls" && <ControlsTab employee={employee} />}
      </div>
    </aside>
  );
}
