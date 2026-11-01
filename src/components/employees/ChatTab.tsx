"use client";

import { useEffect, useState } from "react";
import { Info, Send } from "lucide-react";
import type { Employee } from "@/lib/employees/types";
import { loadMessages, sendMessage } from "@/lib/data/company";
import { getBrowserClient } from "@/lib/supabase/client";
import { useEmployeeStore } from "@/store/employees";
import { Button } from "@/components/ui/button";

export function ChatTab({ employee }: { employee: Employee }) {
  const mode = useEmployeeStore((s) => s.mode);
  const conv = useEmployeeStore((s) => s.conversations.find((c) => c.employeeId === employee.id));
  const messages = useEmployeeStore((s) => (conv ? s.messages[conv.id] : undefined));
  const live = mode === "live";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const sb = getBrowserClient();
    if (!live || !sb || !conv || messages) return;
    loadMessages(sb, conv.id).catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, [live, conv, messages]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserClient();
    if (!sb) return;
    setBusy(true);
    setErr(null);
    try { await sendMessage(sb, employee.id, text); setText(""); }
    catch (e2) { setErr(e2 instanceof Error ? e2.message : String(e2)); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-400/5 p-3 text-xs text-amber-100/90">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden />
        <p>
          {live
            ? `Your messages are saved, but ${employee.name.split(" ")[0]} will not answer yet — the AI connection is built in Milestone 4. Nothing here is simulated.`
            : "Demo mode: Supabase is not configured, so messages cannot be saved."}
        </p>
      </div>
      {(messages ?? []).length === 0 ? (
        <p className="py-4 text-center text-slate-400">No messages yet.</p>
      ) : (
        <ul className="space-y-2">
          {(messages ?? []).map((m) => (
            <li key={m.id} className={m.role === "user" ? "ml-8 rounded-lg bg-amber-500/15 p-2.5" : "mr-8 rounded-lg bg-white/5 p-2.5"}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              <time className="text-[10px] text-slate-500" dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString()}</time>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="text-xs text-red-400">{err}</p>}
      <form className="flex gap-2" onSubmit={submit}>
        <input
          value={text} onChange={(e) => setText(e.target.value)} disabled={!live || busy} maxLength={50000}
          aria-label="Message" placeholder={`Message ${employee.name.split(" ")[0]}…`}
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm disabled:opacity-40"
        />
        <Button type="submit" variant="primary" disabled={!live || busy || !text.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}
