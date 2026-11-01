"use client";

import { useState } from "react";
import { Bot, Pause, Play } from "lucide-react";
import type { Employee, EmployeeStatus } from "@/lib/employees/types";
import { ALL_STATUSES, STATUS_META } from "@/lib/employees/status";
import { ApiError, controlEmployee, saveEmployeeConfig, triggerWorker } from "@/lib/data/company";
import { getBrowserClient } from "@/lib/supabase/client";
import { effectiveStatus, useEmployeeStore } from "@/store/employees";
import { Button } from "@/components/ui/button";

const input = "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-40";

function ConfigureForm({ employee }: { employee: Employee }) {
  const [personality, setPersonality] = useState(employee.personality);
  const [instructions, setInstructions] = useState(employee.systemInstructions);
  const [modelName, setModelName] = useState(employee.model.name);
  const [state, setState] = useState<{ busy: boolean; msg?: string; error?: string }>({ busy: false });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserClient();
    if (!sb) return;
    setState({ busy: true });
    try {
      await saveEmployeeConfig(sb, employee.id, { personality, systemInstructions: instructions, modelName });
      setState({ busy: false, msg: "Saved." });
    } catch (err) {
      setState({ busy: false, error: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <form onSubmit={save} className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-slate-300">Configure employee</h3>
      <label className="block text-xs text-slate-400">Personality
        <textarea className={`${input} mt-1`} rows={2} value={personality} onChange={(e) => setPersonality(e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">System instructions
        <textarea className={`${input} mt-1`} rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </label>
      <label className="block text-xs text-slate-400">Model
        <input className={`${input} mt-1 font-mono`} value={modelName} onChange={(e) => setModelName(e.target.value)} />
      </label>
      {state.error && <p role="alert" className="text-xs text-red-400">{state.error}</p>}
      {state.msg && <p role="status" className="text-xs text-emerald-400">{state.msg}</p>}
      <Button type="submit" variant="primary" disabled={state.busy}>Save changes</Button>
    </form>
  );
}

export function ControlsTab({ employee }: { employee: Employee }) {
  const mode = useEmployeeStore((s) => s.mode);
  const status = useEmployeeStore((s) => effectiveStatus(s, employee.id));
  const previewing = useEmployeeStore((s) => s.previews[employee.id] !== undefined);
  const setPreviewStatus = useEmployeeStore((s) => s.setPreviewStatus);
  const live = mode === "live";
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (fn: () => Promise<string>) => {
    setBusy(true); setMsg(null); setErr(null);
    try { setMsg(await fn()); }
    catch (e) { setErr(e instanceof ApiError || e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <Button disabled={!live || busy} onClick={() => run(async () => { await triggerWorker(); return "Started: queued tasks are being run."; })}><Play className="h-4 w-4" /> Start</Button>
          <Button disabled={!live || busy || status === "paused"} onClick={() => run(async () => { await controlEmployee(employee.id, "pause"); return "Paused. No new work will be started."; })}><Pause className="h-4 w-4" /> Pause</Button>
          <Button disabled={!live || busy || status !== "paused"} onClick={() => run(async () => { await controlEmployee(employee.id, "resume"); return "Resumed. Paused tasks stay paused until you resume them in Tasks."; })}><Play className="h-4 w-4" /> Resume</Button>
        </div>
        <p className="text-xs text-slate-400">
          Start runs this company&rsquo;s queued tasks now. Pause stops this employee from taking new work and pauses their running task.
        </p>
        {msg && <p role="status" className="text-xs text-emerald-400">{msg}</p>}
        {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
      </div>

      {mode === "live" ? <ConfigureForm key={employee.id} employee={employee} /> : (
        <p className="text-xs text-slate-400">Configuring employees needs Supabase to be connected.</p>
      )}

      <div className="rounded-lg border border-dashed border-white/15 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-300">
          <Bot className="h-4 w-4" aria-hidden /> Demo preview
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Visual test of avatar poses and status labels only. It does <strong>not</strong> run any task and is
          never saved. Cleared on reload.
        </p>
        <label className="sr-only" htmlFor="preview-status">Preview status</label>
        <select
          id="preview-status"
          value={previewing ? status : ""}
          onChange={(e) => setPreviewStatus(employee.id, e.target.value ? (e.target.value as EmployeeStatus) : null)}
          className="w-full rounded-md border border-white/10 bg-slate-800 px-2 py-1.5 text-sm"
        >
          <option value="">Real status</option>
          {ALL_STATUSES.filter((s) => s !== "idle").map((s) => (
            <option key={s} value={s}>{STATUS_META[s].label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
