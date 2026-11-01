"use client";

import { useState } from "react";
import { Bot, Info, Pause, Play } from "lucide-react";
import type { Employee, EmployeeStatus } from "@/lib/employees/types";
import { ALL_STATUSES, STATUS_META } from "@/lib/employees/status";
import { saveEmployeeConfig } from "@/lib/data/company";
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p>Start, pause and resume act on a real execution queue. <span className="text-amber-300">Planned for Milestone 4.</span> Nothing here is simulated.</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button disabled><Play className="h-4 w-4" /> Start</Button>
        <Button disabled><Pause className="h-4 w-4" /> Pause</Button>
        <Button disabled><Play className="h-4 w-4" /> Resume</Button>
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
