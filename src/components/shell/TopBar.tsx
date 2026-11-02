"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Search, Settings } from "lucide-react";
import { signOut } from "@/app/login/actions";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore, type AppTab } from "@/store/ui";
import { cn } from "@/lib/utils";

const TABS: { id: AppTab; label: string }[] = [
  { id: "office", label: "Office" }, { id: "tasks", label: "Tasks" }, { id: "approvals", label: "Approvals" },
  { id: "dashboard", label: "Dashboard" }, { id: "brain", label: "Brain" },
];

export function TopBar() {
  const tab = useUiStore((s) => s.tab);
  const setPalette = useUiStore((s) => s.setPaletteOpen);
  const setTab = useUiStore((s) => s.setTab);
  const mode = useEmployeeStore((s) => s.mode);
  const email = useEmployeeStore((s) => s.userEmail);
  const employees = useEmployeeStore((s) => s.employees);
  const statuses = useEmployeeStore((s) => s.statuses);
  const tasks = useEmployeeStore((s) => s.tasks);
  const approvals = useEmployeeStore((s) => s.pendingApprovals);
  const unread = useEmployeeStore((s) => s.unreadNotifications);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); useUiStore.getState().setPaletteOpen(true); }
    };
    const onDown = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(false); };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, []);

  const working = employees.filter((e) => statuses[e.id] === "working").length;
  const openTasks = tasks.filter((t) => ["queued", "running", "waiting_for_approval", "paused"].includes(t.status)).length;
  const initials = (email ?? "CEO").slice(0, 2).toUpperCase();
  const badge = (n: number, cls: string) => n > 0 && <span className={cn("rounded-[5px] px-1.5 py-px font-mono text-[11px]", cls)}>{n}</span>;
  const live = mode === "live";

  return (
    <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--border)] bg-surface-1 px-4 py-2.5">
      <div className="flex min-w-[220px] flex-1 items-center gap-2.5">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-primary">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="8" strokeOpacity="0.55" /></svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight">Embassey AI HQ</span>
        <button disabled title="Workspaces: coming soon" className="flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.09] bg-surface-3 px-2.5 text-[13px] text-[#C9CED8] disabled:cursor-default">Embassey Inc.<ChevronDown className="h-3 w-3" aria-hidden /></button>
      </div>

      <nav aria-label="Primary" className="flex gap-0.5 rounded-[10px] border border-white/[0.06] bg-surface-3 p-[3px]">
        {TABS.map((t) => {
          const built = t.id !== "brain";
          const active = tab === t.id;
          return (
            <button key={t.id} disabled={!built} onClick={() => setTab(t.id)} aria-current={active ? "page" : undefined} title={built ? undefined : "Coming soon"}
              className={cn("flex items-center gap-1.5 rounded-[7px] px-3.5 py-[7px] text-[13px]", active ? "bg-bubble-me font-medium text-white" : "text-text-2", !built && "cursor-default opacity-60")}>
              {t.label}
              {t.id === "tasks" && badge(openTasks, "bg-[#2A3044] text-[#C9D0FF]")}
              {t.id === "approvals" && badge(approvals, "bg-[#3A2A1E] text-[#FFB27A]")}
            </button>
          );
        })}
      </nav>

      <div className="flex min-w-[220px] flex-1 flex-wrap items-center justify-end gap-2.5">
        <button onClick={() => setPalette(true)} className="flex h-[34px] min-w-[200px] items-center gap-2 rounded-[9px] border border-white/[0.09] bg-surface-3 px-2.5 text-[13px] text-text-3">
          <Search className="h-3.5 w-3.5" aria-hidden /><span className="flex-1 text-left">Ask any employee…</span>
          <kbd className="rounded-[5px] border border-white/[0.12] px-[5px] py-0.5 font-mono text-[11px]">⌘K</kbd>
        </button>
        <div className="flex h-[34px] items-center gap-[7px] rounded-[9px] border border-[#1F4A32] bg-[#10241A] px-3 text-[13px] text-[#BFF0D2]">
          <span className="h-[7px] w-[7px] rounded-full bg-[#3DDC84] shadow-[0_0_8px_#3DDC84]" />{employees.length} employees · {working} working
        </div>
        <button aria-label={`Notifications, ${unread} unread`} title="Notification list: coming soon" className="relative flex h-9 w-9 items-center justify-center rounded-[9px] border border-white/[0.09] bg-surface-3 text-[#C9CED8]">
          <Bell className="h-4 w-4" aria-hidden />
          {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF5A5F] px-1 text-[10px] font-semibold text-white">{unread}</span>}
        </button>
        <div ref={menuRef} className="relative">
          <button aria-label={`Account${email ? `: ${email}` : ""}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}
            className="h-9 w-9 rounded-full border-2 border-[#2A3044] bg-[#E8D5B5] text-xs font-bold text-[#2A1E10]">{initials}</button>
          {menu && (
            <div role="menu" className="absolute right-0 top-11 z-40 w-48 rounded-xl border border-white/[0.09] bg-surface-2 p-1.5 shadow-xl">
              {email && <div className="truncate px-2.5 py-1.5 text-xs text-text-3">{email}</div>}
              {live ? (
                <>
                  <Link role="menuitem" href="/settings" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-[#DDE1E8] hover:bg-surface-3"><Settings className="h-4 w-4" aria-hidden /> Settings & API keys</Link>
                  <form action={signOut}><button role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-[#DDE1E8] hover:bg-surface-3"><LogOut className="h-4 w-4" aria-hidden /> Sign out</button></form>
                </>
              ) : <div className="px-2.5 py-2 text-xs text-text-3">Demo mode: sign-in is available once Supabase is configured.</div>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
