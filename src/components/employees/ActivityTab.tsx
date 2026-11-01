"use client";

import { useMemo } from "react";
import type { Employee } from "@/lib/employees/types";
import { useEmployeeStore } from "@/store/employees";

const LEVEL: Record<string, string> = {
  debug: "text-slate-500", info: "text-slate-300", warn: "text-amber-300", error: "text-red-300",
};

export function ActivityTab({ employee }: { employee: Employee }) {
  const all = useEmployeeStore((s) => s.activity);
  const mode = useEmployeeStore((s) => s.mode);
  const entries = useMemo(() => all.filter((a) => a.employeeId === employee.id), [all, employee.id]);

  if (mode !== "live") return <p className="py-6 text-center text-slate-400">Activity is recorded once Supabase is connected.</p>;
  if (entries.length === 0) {
    return <p className="py-6 text-center text-slate-400">No activity recorded for {employee.name.split(" ")[0]} yet. Actions, tool use, errors and completed work will appear here as they happen.</p>;
  }
  return (
    <ul className="space-y-2">
      {entries.map((a) => (
        <li key={a.id} className="rounded-lg border border-white/10 p-2.5">
          <div className="flex justify-between gap-2 text-xs text-slate-500">
            <span className="font-mono">{a.eventType}</span>
            <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString()}</time>
          </div>
          <p className={LEVEL[a.level]}>{a.message}</p>
        </li>
      ))}
    </ul>
  );
}
