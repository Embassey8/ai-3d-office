"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Mic, Paperclip, Send } from "lucide-react";
import { ApiError, decideApproval, loadMessages, sendChat } from "@/lib/data/company";
import type { ChatMessage, PendingApproval, Task } from "@/lib/data/types";
import type { Employee } from "@/lib/employees/types";
import { STATUS_META } from "@/lib/employees/status";
import { modelFamily } from "@/lib/office/departments";
import { DEMO_THREAD_ADA } from "@/lib/mock/demoThread";
import { getBrowserClient } from "@/lib/supabase/client";
import { effectiveStatus, useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { avatarColor, displayRole, initial, PRIORITY_STYLE, statusLine, taskCode } from "@/components/shell/format";
import { cn } from "@/lib/utils";

const SLASH = ["/assign", "/standup", "/approvals", "/meeting"];
const mono = "font-mono";

type Item =
  | { kind: "message"; at: string; m: ChatMessage }
  | { kind: "task"; at: string; t: Task }
  | { kind: "approval"; at: string; a: PendingApproval };

function Avatar({ e, size = 26 }: { e: Employee; size?: number }) {
  return <span className="flex flex-none items-center justify-center rounded-full font-bold text-[#0B0D12]" style={{ width: size, height: size, background: avatarColor(e), fontSize: size * 0.42 }}>{initial(e)}</span>;
}

function ApprovalCard({ a, employee }: { a: PendingApproval; employee: Employee }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (d: "approved" | "rejected") => {
    const sb = getBrowserClient();
    if (!sb) return;
    setBusy(true); setErr(null);
    try { await decideApproval(sb, a.id, d); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); setBusy(false); }
  };
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-[#4A3320] bg-[#1A140F] p-3">
      <div className={cn(mono, "flex items-center gap-2 text-xs tracking-[0.06em] text-[#FFB27A]")}><AlertTriangle className="h-[13px] w-[13px]" aria-hidden />APPROVAL NEEDED</div>
      <div className="font-semibold text-white">{a.description}</div>
      <div className="text-xs text-[#B9AFA5]">{employee.name} · {displayRole(employee)}</div>
      {err && <div role="alert" className="text-xs text-red-300">{err}</div>}
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide("approved")} className="h-[34px] flex-1 rounded-lg bg-primary text-[13px] font-semibold text-white disabled:opacity-50">Approve</button>
        <button disabled={busy} onClick={() => decide("rejected")} className="h-[34px] flex-1 rounded-lg border border-white/[0.14] text-[13px] text-[#E3E6EC] disabled:opacity-50">Reject</button>
      </div>
    </div>
  );
}

function TaskCard({ t, employee }: { t: Task; employee: Employee }) {
  const p = PRIORITY_STYLE[t.priority];
  const live = t.status === "running" ? "#3DDC84" : t.status === "failed" ? "#FF5A5F" : t.status === "waiting_for_approval" ? "#FF8A3D" : t.status === "completed" ? "#7EE2A8" : "#8A93A3";
  const label = t.status === "running" ? "Working" : t.status === "waiting_for_approval" ? "Needs approval" : t.status[0].toUpperCase() + t.status.slice(1);
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-white/[0.09] bg-surface-3 p-3">
      <div className={cn(mono, "flex items-center justify-between text-[11px] tracking-[0.06em] text-text-3")}>
        <span>TASK · {taskCode(t.id)}</span><span className="rounded-[5px] px-[7px] py-0.5" style={{ background: p.bg, color: p.fg }}>{p.label}</span>
      </div>
      <div className="font-semibold text-white">{t.title}</div>
      <div className="flex items-center gap-2 text-xs text-text-2">
        <Avatar e={employee} size={20} />{employee.name} · {displayRole(employee)}
        <span className="ml-auto flex items-center gap-[5px]" style={{ color: live }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: live }} />{label}</span>
      </div>
      {t.status === "completed" && <><div className="h-1 rounded-sm bg-[#232838]"><div className="h-1 w-full rounded-sm bg-[#3DDC84]" /></div>{t.result && <p className="line-clamp-4 whitespace-pre-wrap text-[13px] text-[#C9CED8]">{t.result}</p>}</>}
      {t.status === "failed" && t.error && <p className="text-[13px] text-red-300">{t.error}</p>}
    </div>
  );
}

function Bubbles({ employee, items }: { employee: Employee; items: Item[] }) {
  const empById = useEmployeeStore((s) => s.employees);
  const allTasks = useEmployeeStore((s) => s.tasks);
  return (
    <>
      {items.map((it) => {
        if (it.kind === "message") {
          const m = it.m;
          if (m.role === "user") return <div key={m.id} className="max-w-[82%] self-end rounded-[14px_14px_4px_14px] bg-bubble-me px-[13px] py-2.5 leading-[1.45] whitespace-pre-wrap">{m.content}</div>;
          const made = (m.taskIds ?? []).flatMap((id) => allTasks.filter((t) => t.id === id));
          return (
            <div key={m.id} className="flex gap-2.5">
              <Avatar e={employee} />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <div className="whitespace-pre-wrap leading-[1.5] text-[#DDE1E8]">{m.content}</div>
                {made.map((t) => <TaskCard key={t.id} t={t} employee={empById.find((e) => e.id === t.employeeId) ?? employee} />)}
              </div>
            </div>
          );
        }
        if (it.kind === "task") {
          const owner = empById.find((e) => e.id === it.t.employeeId) ?? employee;
          return <div key={it.t.id} className="pl-9"><TaskCard t={it.t} employee={owner} /></div>;
        }
        return <div key={it.a.id} className="pl-9"><ApprovalCard a={it.a} employee={employee} /></div>;
      })}
    </>
  );
}

export function ChatPanel() {
  const mode = useEmployeeStore((s) => s.mode);
  const employees = useEmployeeStore((s) => s.employees);
  const statuses = useEmployeeStore((s) => s.statuses);
  const previews = useEmployeeStore((s) => s.previews);
  const tasks = useEmployeeStore((s) => s.tasks);
  const approvals = useEmployeeStore((s) => s.approvals);
  const conversations = useEmployeeStore((s) => s.conversations);
  const messagesByConv = useEmployeeStore((s) => s.messages);
  const activeId = useUiStore((s) => s.activeChatId);
  const setActive = useUiStore((s) => s.setActiveChat);
  const live = mode === "live";

  const active = employees.find((e) => e.id === activeId) ?? employees.find((e) => e.slug === "exec-assistant") ?? employees[0];
  const conv = conversations.find((c) => c.employeeId === active?.id);
  const messages = conv ? messagesByConv[conv.id] : undefined;

  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load the stored thread when a DM opens.
  useEffect(() => {
    const sb = getBrowserClient();
    if (!live || !sb || !conv || messages) return;
    loadMessages(sb, conv.id).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [live, conv, messages]);

  const items = useMemo<Item[]>(() => {
    if (!active || !live) return [];
    const out: Item[] = [];
    for (const m of messages ?? []) out.push({ kind: "message", at: m.createdAt, m });
    const shown = new Set((messages ?? []).flatMap((m) => m.taskIds ?? []));
    for (const t of tasks) if (t.employeeId === active.id && !shown.has(t.id)) out.push({ kind: "task", at: t.createdAt, t });
    for (const a of approvals) if (a.employeeId === active.id) out.push({ kind: "approval", at: a.createdAt, a });
    return out.sort((x, y) => x.at.localeCompare(y.at));
  }, [active, live, messages, tasks, approvals]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [items.length, pending, active?.id]);

  if (!active) {
    return <aside aria-label="Chat" className="flex min-h-[320px] flex-1 items-center justify-center border-r border-[var(--border)] bg-surface-2 p-6 text-sm text-text-3">{mode === "error" ? "Could not load your team." : "Loading your team…"}</aside>;
  }

  const status = effectiveStatus({ statuses, previews }, active.id);
  const meta = STATUS_META[status];
  const currentTask = tasks.find((t) => t.id === active.currentTaskId);
  const busyNow = status === "thinking" || status === "working";

  const send = async () => {
    const sb = getBrowserClient();
    const outgoing = text.trim();
    if (!sb || !outgoing || busy) return;
    setBusy(true); setErr(null); setPending(outgoing); setText("");
    try { await sendChat(sb, active.id, outgoing); }
    catch (e) { setErr(e instanceof ApiError || e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); setPending(null); }
  };

  return (
    <aside aria-label={`Chat with ${active.name}`} className="flex min-h-[420px] min-w-0 flex-col border-b border-[var(--border)] bg-surface-2 lg:min-h-0 lg:border-b-0 lg:border-r">
      <div className="flex flex-col gap-3 border-b border-white/[0.06] px-4 pb-2.5 pt-3.5">
        <div className="flex items-center justify-between">
          <span className={cn(mono, "text-[11px] tracking-[0.12em] text-text-3")}>TEAM</span>
          <button disabled title="Hiring: coming soon" className="py-1.5 text-xs text-text-2 disabled:cursor-default disabled:opacity-60">+ Hire employee</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {employees.map((e) => {
            const st = effectiveStatus({ statuses, previews }, e.id);
            return (
              <button key={e.id} aria-label={`Chat with ${e.name}, ${displayRole(e)}`} aria-pressed={e.id === active.id} onClick={() => { setActive(e.id); setErr(null); }}
                className="relative h-[38px] w-[38px] rounded-full text-[13px] font-bold text-[#0B0D12]" style={{ background: avatarColor(e), border: e.id === active.id ? "2px solid #ECEEF2" : "2px solid transparent" }}>
                {initial(e)}
                <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-surface-2" style={{ background: STATUS_META[st].color }} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
        <Avatar e={active} size={34} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{active.name} <span className="font-normal text-text-3">· {displayRole(active)}</span></div>
          <div className="flex items-center gap-1.5 truncate text-xs text-[#9AA3B2]"><span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: meta.color }} />{statusLine(status, currentTask)}</div>
        </div>
        <span className={cn(mono, "rounded-md bg-[#1C2130] px-2 py-1 text-[11px] text-[#C9CED8]")}>{modelFamily(active.model.name)}</span>
        <button disabled aria-label={`Voice chat with ${active.name}: coming soon`} title="Voice chat: coming soon" className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-white/[0.09] bg-surface-3 text-[#C9CED8] opacity-60"><Mic className="h-[15px] w-[15px]" aria-hidden /></button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4" role="log" aria-live="polite" aria-label="Conversation">
        {!live && (
          <>
            <div className="self-center rounded-full border border-amber-400/25 bg-amber-950/40 px-3 py-1 text-[11px] text-amber-100">Sample conversation · demo mode · nothing is saved or sent</div>
            {active.slug === "exec-assistant" ? DEMO_THREAD_ADA.map((d, i) => {
              if (d.kind === "time") return <div key={i} className={cn(mono, "self-center text-[11px] text-text-3")}>{d.text}</div>;
              if (d.kind === "me") return <div key={i} className="max-w-[82%] self-end rounded-[14px_14px_4px_14px] bg-bubble-me px-[13px] py-2.5">{d.text}</div>;
              if (d.kind === "agent") return <div key={i} className="flex gap-2.5"><Avatar e={active} /><div className="leading-[1.5] text-[#DDE1E8]">{d.text}</div></div>;
              if (d.kind === "approval") return (
                <div key={i} className="pl-9"><div className="flex flex-col gap-2.5 rounded-xl border border-[#4A3320] bg-[#1A140F] p-3">
                  <div className={cn(mono, "flex items-center gap-2 text-xs tracking-[0.06em] text-[#FFB27A]")}><AlertTriangle className="h-[13px] w-[13px]" aria-hidden />APPROVAL NEEDED</div>
                  <div className="font-semibold text-white">{d.title}</div><div className="text-xs text-[#B9AFA5]">{d.meta}</div>
                </div></div>
              );
              return (
                <div key={i} className="pl-9"><div className="flex flex-col gap-2 rounded-xl border border-white/[0.09] bg-surface-3 p-3">
                  <div className={cn(mono, "flex justify-between text-[11px] text-text-3")}><span>TASK · {d.taskId}</span><span className="rounded-[5px] bg-[#2E2214] px-[7px] py-0.5 text-[#FFC46B]">{d.priority}</span></div>
                  <div className="font-semibold text-white">{d.title}</div><div className="text-xs text-text-2">{d.assignee}</div>
                  <div className="h-1 rounded-sm bg-[#232838]"><div className="h-1 rounded-sm bg-[#3DDC84]" style={{ width: `${d.progress}%` }} /></div>
                </div></div>
              );
            }) : <p className="py-6 text-center text-sm text-text-3">No sample conversation for {active.name}.</p>}
          </>
        )}

        {live && items.length === 0 && !pending && <p className="py-8 text-center text-sm text-text-3">This is the start of your conversation with {active.name}. Ask a question, or assign work: {active.name} turns requests into tasks you can track here.</p>}
        {live && <Bubbles employee={active} items={items} />}
        {pending && <div className="max-w-[82%] self-end rounded-[14px_14px_4px_14px] bg-bubble-me px-[13px] py-2.5 whitespace-pre-wrap">{pending}</div>}
        {live && (busy || busyNow) && (
          <div className="flex items-center gap-2 pl-9 text-xs text-[#9AA3B2]" aria-live="polite">
            <span className="flex gap-[3px]">{["hq-dot-1", "hq-dot-2", "hq-dot-3"].map((c) => <span key={c} className={cn(c, "h-[5px] w-[5px] rounded-full")} style={{ background: avatarColor(active) }} />)}</span>
            {active.name} is {status === "working" && currentTask ? `working on “${currentTask.title}”` : "thinking"}…
          </div>
        )}
        {err && <p role="alert" className="rounded-lg border border-red-400/25 bg-red-950/30 p-2.5 text-xs text-red-200">{err}{/Settings/.test(err) && <> <a href="/settings" className="underline">Open Settings</a></>}</p>}
        <div ref={endRef} />
      </div>

      <div className="flex flex-col gap-2.5 border-t border-white/[0.06] px-4 pb-4 pt-3">
        <div className="flex flex-wrap gap-1.5">
          {SLASH.map((c) => <button key={c} disabled title="Slash commands: coming soon" className={cn(mono, "h-7 rounded-[7px] border border-white/[0.09] bg-surface-3 px-2.5 text-[11px] text-[#C9CED8] opacity-60")}>{c}</button>)}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-end gap-2 rounded-[14px] border border-white/10 bg-[#171B24] p-2">
          <label htmlFor="chat-msg" className="sr-only">Message {active.name}</label>
          <textarea id="chat-msg" rows={2} value={text} onChange={(e) => setText(e.target.value)} disabled={!live || busy} maxLength={8000}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={live ? `Message ${active.name}…` : "Demo mode: connect Supabase to chat"}
            className="min-w-0 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm leading-[1.45] outline-none placeholder:text-text-3 disabled:opacity-50" />
          <button type="button" disabled aria-label="Attach a file: coming soon" title="Attachments: coming soon" className="flex h-9 w-9 items-center justify-center rounded-[10px] text-text-2 opacity-50"><Paperclip className="h-[17px] w-[17px]" aria-hidden /></button>
          <button type="button" disabled aria-label="Talk: coming soon" title="Voice: coming soon" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#2A1717] text-[#FF8A80] opacity-50"><Mic className="h-4 w-4" aria-hidden /></button>
          <button type="submit" disabled={!live || busy || !text.trim()} aria-label="Send" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-primary text-white disabled:opacity-40"><Send className="h-4 w-4" aria-hidden /></button>
        </form>
      </div>
    </aside>
  );
}
