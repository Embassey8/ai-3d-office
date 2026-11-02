"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { decideApproval } from "@/lib/data/company";
import type { PendingApproval } from "@/lib/data/types";
import { getBrowserClient } from "@/lib/supabase/client";
import { useEmployeeStore } from "@/store/employees";
import { avatarColor, displayRole, initial } from "@/components/shell/format";
import { cn } from "@/lib/utils";
import { cardCls, LiveOnly, PageFrame } from "./PageFrame";

const ACTION_LABEL: Record<string, string> = {
  spend_money: "SPENDING MONEY", publish_advertisement: "PUBLIC POST / AD", issue_refund: "REFUND", send_bulk_communication: "BULK MESSAGE",
  place_supplier_order: "SUPPLIER ORDER", delete_records: "DELETING RECORDS", financial_commitment: "FINANCIAL COMMITMENT", other: "ACTION",
};

function Row({ a }: { a: PendingApproval }) {
  const employees = useEmployeeStore((s) => s.employees);
  const e = employees.find((x) => x.id === a.employeeId);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const decide = async (d: "approved" | "rejected") => {
    const sb = getBrowserClient();
    if (!sb) return;
    setBusy(true); setErr(null);
    try { await decideApproval(sb, a.id, d, note); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); setBusy(false); }
  };
  return (
    <li className="flex flex-col gap-3 rounded-xl border border-[#4A3320] bg-[#1A140F] p-4">
      <div className="flex items-center gap-2 font-mono text-xs tracking-[0.06em] text-[#FFB27A]"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />NEEDS APPROVAL · {ACTION_LABEL[a.actionType] ?? "ACTION"}</div>
      <div className="text-[15px] font-semibold text-white">{a.description}</div>
      {e && (
        <div className="flex items-center gap-2 text-xs text-[#B9AFA5]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-[#0B0D12]" style={{ background: avatarColor(e) }}>{initial(e)}</span>
          {e.name} · {displayRole(e)} · {new Date(a.createdAt).toLocaleString()}
        </div>
      )}
      <label className="sr-only" htmlFor={`note-${a.id}`}>Note (optional)</label>
      <input id={`note-${a.id}`} value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Add a note for the record (optional)" maxLength={500}
        className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-text-3 focus-visible:border-primary" />
      {err && <p role="alert" className="text-xs text-red-300">{err}</p>}
      <div className="flex gap-2">
        <button disabled={busy} onClick={() => decide("approved")} className="h-[38px] flex-1 rounded-[9px] bg-primary text-[13px] font-semibold text-white disabled:opacity-50">Approve</button>
        <button disabled={busy} onClick={() => decide("rejected")} className="h-[38px] flex-1 rounded-[9px] border border-white/[0.14] text-[13px] text-[#E3E6EC] disabled:opacity-50">Reject</button>
      </div>
      <p className="text-[11px] text-[#9C8F82]">Approval is single-use and covers exactly this action.</p>
    </li>
  );
}

export function ApprovalsPage() {
  const mode = useEmployeeStore((s) => s.mode);
  const approvals = useEmployeeStore((s) => s.approvals);
  return (
    <PageFrame title="Approvals" subtitle="Sensitive actions your employees will not take without you: spending, publishing, refunds, bulk messages.">
      <LiveOnly mode={mode} />
      {mode === "live" && approvals.length === 0 && <p className={cn(cardCls, "p-8 text-center text-sm text-text-3")}>Nothing is waiting for your approval.</p>}
      <ul className="flex flex-col gap-3">{approvals.map((a) => <Row key={a.id} a={a} />)}</ul>
    </PageFrame>
  );
}
