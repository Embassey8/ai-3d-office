"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { agentsByRoom, roomForDepartment } from "@/lib/office/departments";
import { avatarColor, displayRole, initial } from "./format";

/** ⌘K: jump to any employee's chat. */
export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const employees = useEmployeeStore((s) => s.employees);
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const n = q.trim().toLowerCase();
    return employees.filter((e) => !n || `${e.name} ${e.title} ${e.department}`.toLowerCase().includes(n));
  }, [employees, q]);

  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  void agentsByRoom;

  if (!open) return null;
  const choose = (id: string) => {
    const e = employees.find((x) => x.id === id);
    useUiStore.getState().setActiveChat(id);
    useEmployeeStore.getState().select(id);
    if (e) useUiStore.getState().focusRoomKey(roomForDepartment(e.department));
    setOpen(false); setQ(""); setIdx(0);
  };
  const close = () => { setOpen(false); setQ(""); setIdx(0); };

  return (
    <div role="dialog" aria-modal="true" aria-label="Ask any employee" className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 p-4 pt-[14vh]" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-surface-2 shadow-2xl">
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} placeholder="Ask any employee…" aria-label="Search employees"
          onKeyDown={(e) => {
            if (e.key === "Escape") close();
            if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
            if (e.key === "Enter" && results[idx]) choose(results[idx].id);
          }}
          className="w-full border-b border-white/[0.07] bg-transparent px-4 py-3.5 text-[15px] outline-none placeholder:text-text-3" />
        <ul role="listbox" className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-text-3">No one by that name.</li>}
          {results.map((e, i) => (
            <li key={e.id} role="option" aria-selected={i === idx}>
              <button onMouseEnter={() => setIdx(i)} onClick={() => choose(e.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === idx ? "bg-surface-3" : ""}`}>
                <span className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold text-[#0B0D12]" style={{ background: avatarColor(e) }}>{initial(e)}</span>
                <span><span className="block text-sm font-medium">{e.name}</span><span className="block text-xs text-text-3">{displayRole(e)} · {e.department}</span></span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
