"use client";

import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import type { Employee } from "@/lib/employees/types";
import type { Task, TaskPriority } from "@/lib/data/types";
import { canDo, isEditable } from "@/lib/data/schemas";
import { changeTaskStatus, createTask, editTask } from "@/lib/data/company";
import { getBrowserClient } from "@/lib/supabase/client";
import { useEmployeeStore } from "@/store/employees";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STATUS_COLOR: Record<Task["status"], string> = {
  queued: "#94a3b8", running: "#34d399", waiting_for_approval: "#fbbf24", paused: "#a78bfa",
  completed: "#2dd4bf", failed: "#f87171", cancelled: "#64748b",
};
const PRIORITIES: TaskPriority[] = ["low", "normal", "high", "urgent"];
const ORDER: Record<Task["status"], number> = {
  running: 0, waiting_for_approval: 1, queued: 2, paused: 3, failed: 4, completed: 5, cancelled: 6,
};
const input = "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-40";

function TaskRow({ task, live }: { task: Task; live: boolean }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [priority, setPriority] = useState(task.priority);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    const sb = getBrowserClient();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  const act = (a: "pause" | "resume" | "cancel") => run(() => changeTaskStatus(getBrowserClient()!, task, a));

  return (
    <li className="space-y-2 rounded-lg border border-white/10 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{task.title}</p>
          <p className="text-xs text-slate-400">
            {task.priority} priority{task.deadline ? ` · due ${new Date(task.deadline).toLocaleString()}` : ""}
          </p>
        </div>
        <Badge color={STATUS_COLOR[task.status]}>{task.status.replaceAll("_", " ")}</Badge>
      </div>
      {task.description && !editing && <p className="whitespace-pre-wrap text-slate-300">{task.description}</p>}
      {task.result && <p className="rounded bg-emerald-500/10 p-2 text-emerald-200"><strong>Result:</strong> {task.result}</p>}
      {task.error && <p className="rounded bg-red-500/10 p-2 text-red-200"><strong>Error:</strong> {task.error}</p>}

      {editing && (
        <div className="space-y-2">
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Task title" maxLength={200} />
          <textarea className={input} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Task description" />
          <select className={`${input} bg-slate-800`} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} aria-label="Priority">
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => run(async () => { await editTask(getBrowserClient()!, task, { title, description, priority }); setEditing(false); })}>Save</Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>Discard</Button>
          </div>
        </div>
      )}
      {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
      {live && !editing && (
        <div className="flex flex-wrap gap-2">
          {isEditable(task.status) && <Button disabled={busy} onClick={() => setEditing(true)}>Edit</Button>}
          {canDo("pause", task.status) && <Button disabled={busy} onClick={() => act("pause")}>Pause</Button>}
          {canDo("resume", task.status) && <Button disabled={busy} onClick={() => act("resume")}>Resume</Button>}
          {canDo("cancel", task.status) && <Button variant="ghost" disabled={busy} onClick={() => act("cancel")}>Cancel</Button>}
        </div>
      )}
    </li>
  );
}

export function TasksTab({ employee }: { employee: Employee }) {
  const mode = useEmployeeStore((s) => s.mode);
  const allTasks = useEmployeeStore((s) => s.tasks);
  const live = mode === "live";
  const tasks = useMemo(
    () => allTasks.filter((t) => t.employeeId === employee.id).sort((a, b) => ORDER[a.status] - ORDER[b.status] || b.createdAt.localeCompare(a.createdAt)),
    [allTasks, employee.id],
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [deadline, setDeadline] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserClient();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    try {
      await createTask(sb, { employeeId: employee.id, title, description, priority, deadline });
      setTitle(""); setDescription(""); setPriority("normal"); setDeadline("");
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p>
          {live
            ? "Tasks are saved to your database and queue up here. Nothing executes them yet — the AI execution engine arrives in Milestone 4, so they stay queued until then."
            : "Demo mode: Supabase is not configured, so tasks cannot be saved. Configure it (see README) to assign tasks."}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-2">
        <input className={input} placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!live || busy} aria-label="New task title" maxLength={200} />
        <textarea className={input} rows={3} placeholder="Details (optional)" value={description} onChange={(e) => setDescription(e.target.value)} disabled={!live || busy} aria-label="New task details" />
        <div className="grid grid-cols-2 gap-2">
          <select className={`${input} bg-slate-800`} value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} disabled={!live || busy} aria-label="New task priority">
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input type="datetime-local" className={input} value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={!live || busy} aria-label="Deadline" />
        </div>
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={!live || busy || !title.trim()}>Assign task</Button>
      </form>

      {tasks.length === 0 ? (
        <p className="py-4 text-center text-slate-400">No tasks for {employee.name.split(" ")[0]} yet.</p>
      ) : (
        <ul className="space-y-2">{tasks.map((t) => <TaskRow key={t.id} task={t} live={live} />)}</ul>
      )}
    </div>
  );
}
