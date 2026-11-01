"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound, ServerCog, ShieldCheck, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Status {
  secrets: { name: string; last4: string; updatedAt: string }[];
  server: { serviceRoleKeyConfigured: boolean; envAnthropicFallback: boolean };
}

const card = "rounded-2xl border border-white/[0.08] bg-[#10131A] p-5";
const label = "font-mono text-[11px] uppercase tracking-[0.12em] text-[#8790A0]";

export function SettingsClient() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/status", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status === 401 ? "Please sign in again." : "Could not load settings.");
      setStatus((await res.json()) as Status);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : String(e));
    }
  }, []);
  // Initial load: state is set from promise callbacks (not synchronously in the effect body).
  useEffect(() => {
    let alive = true;
    fetch("/api/settings/status", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? "Please sign in again." : "Could not load settings.");
        return res.json() as Promise<Status>;
      })
      .then((s) => { if (alive) setStatus(s); })
      .catch((e: unknown) => { if (alive) setLoadError(e instanceof Error ? e.message : String(e)); });
    return () => { alive = false; };
  }, []);

  const anthropic = status?.secrets.find((s) => s.name === "anthropic_api_key");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings/api-key", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "anthropic_api_key", value }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; warning?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not save the key.");
      setValue("");  // never keep the key in the page after saving
      setMsg(json.warning ? { kind: "warn", text: json.warning } : { kind: "ok", text: "Saved and verified with Anthropic. Your employees will use this key." });
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Remove your Anthropic API key? Employees will stop working until you add one again.")) return;
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/settings/api-key?name=anthropic_api_key", { method: "DELETE" });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Could not remove the key.");
      setMsg({ kind: "ok", text: "Key removed." });
      await load();
    } catch (err) {
      setMsg({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally { setBusy(false); }
  };

  return (
    <main className="min-h-dvh bg-[#0B0D12] text-[#ECEEF2]">
      <header className="flex h-14 items-center gap-3 border-b border-white/[0.07] bg-[#0E1117] px-4">
        <Link href="/" className="flex items-center gap-1.5 text-sm text-[#AEB5C2] hover:text-white"><ArrowLeft className="h-4 w-4" aria-hidden /> Back to HQ</Link>
        <span className="text-[#5D6575]">/</span>
        <span className="text-sm font-medium">Settings</span>
      </header>

      <div className="mx-auto flex max-w-2xl flex-col gap-5 p-4 py-8">
        <div>
          <h1 className="text-xl font-semibold">API keys</h1>
          <p className="mt-1 text-sm text-[#9AA3B2]">Keys you add here power your AI employees. They are encrypted in Supabase Vault and used only by the server.</p>
        </div>

        {loadError && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/40 p-3 text-sm text-red-200">{loadError}</p>}

        <section className={card} aria-labelledby="anthropic-h">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#4F5BD5]"><KeyRound className="h-4 w-4 text-white" aria-hidden /></div>
            <div className="min-w-0 flex-1">
              <h2 id="anthropic-h" className="font-semibold">Anthropic (Claude)</h2>
              <p className="mt-0.5 text-sm text-[#9AA3B2]">Runs every employee&rsquo;s chat and tasks. Get a key at console.anthropic.com.</p>
            </div>
            {anthropic ? (
              <span className="flex items-center gap-1.5 rounded-md bg-[#10241A] px-2.5 py-1 text-xs text-[#BFF0D2]"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Configured · ••••{anthropic.last4}</span>
            ) : (
              <span className="rounded-md bg-[#2E1D12] px-2.5 py-1 text-xs text-[#FFC6A0]">Not set</span>
            )}
          </div>

          <form onSubmit={save} className="mt-4 space-y-3">
            <label htmlFor="anthropic-key" className={label}>{anthropic ? "Replace key" : "API key"}</label>
            <input
              id="anthropic-key" type="password" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)}
              placeholder="sk-ant-…" disabled={busy}
              className="w-full rounded-lg border border-white/10 bg-[#171B24] px-3 py-2.5 font-mono text-sm outline-none focus-visible:border-[#4F5BD5] disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" variant="primary" disabled={busy || value.trim().length < 20}>{busy ? "Working…" : "Save & verify"}</Button>
              {anthropic && <Button type="button" variant="ghost" disabled={busy} onClick={remove}>Remove key</Button>}
            </div>
            {msg && (
              <p role={msg.kind === "error" ? "alert" : "status"} className={msg.kind === "error" ? "text-sm text-red-300" : msg.kind === "warn" ? "text-sm text-amber-300" : "text-sm text-emerald-300"}>{msg.text}</p>
            )}
          </form>
          <p className="mt-4 flex items-start gap-2 text-xs text-[#8790A0]"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />The key is checked with Anthropic when you save it (this uses no tokens), is never shown again, and is never sent to your browser after saving.</p>
        </section>

        <section className={card} aria-labelledby="server-h">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[#1A1E28]"><ServerCog className="h-4 w-4 text-[#C9CED8]" aria-hidden /></div>
            <h2 id="server-h" className="font-semibold">Server status</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <div><dt>Supabase service-role key</dt><dd className="mt-0.5 text-xs text-[#8790A0]">Lets the server run background work. This is the one secret that cannot be stored in the database it unlocks, so it is set once in your hosting environment (e.g. Vercel → Settings → Environment Variables as <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code>).</dd></div>
              {status && (status.server.serviceRoleKeyConfigured
                ? <span className="flex-none rounded-md bg-[#10241A] px-2 py-1 text-xs text-[#BFF0D2]">Set</span>
                : <span className="flex flex-none items-center gap-1 rounded-md bg-[#2E1D12] px-2 py-1 text-xs text-[#FFC6A0]"><TriangleAlert className="h-3 w-3" aria-hidden />Missing</span>)}
            </div>
            <div className="flex items-start justify-between gap-4">
              <div><dt>Server-level Anthropic key (fallback)</dt><dd className="mt-0.5 text-xs text-[#8790A0]">Optional. Used only when you have not saved your own key above.</dd></div>
              {status && <span className="flex-none rounded-md bg-[#1A1E28] px-2 py-1 text-xs text-[#C9CED8]">{status.server.envAnthropicFallback ? "Set" : "Not set"}</span>}
            </div>
          </dl>
          {status && !status.server.serviceRoleKeyConfigured && (
            <p className="mt-4 rounded-lg border border-amber-400/25 bg-amber-400/5 p-3 text-xs text-amber-100/90">Until the service-role key is set, your key is saved safely but employees cannot run tasks or reply in chat.</p>
          )}
        </section>
      </div>
    </main>
  );
}
