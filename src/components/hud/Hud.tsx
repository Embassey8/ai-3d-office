"use client";

import { useEffect, useState } from "react";
import { Camera, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { setVirtualAxis } from "@/lib/input";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";

function TouchPad() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  if (!coarse) return null;

  const btn = (label: string, x: number, z: number, cls: string) => (
    <button
      aria-label={`Move ${label}`}
      className={cn(
        "absolute h-14 w-14 select-none rounded-full border border-white/20 bg-slate-900/70 text-lg text-white backdrop-blur active:bg-amber-500/60",
        cls,
      )}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setVirtualAxis(x, z);
      }}
      onPointerUp={() => setVirtualAxis(0, 0)}
      onPointerCancel={() => setVirtualAxis(0, 0)}
      style={{ touchAction: "none" }}
    >
      {label}
    </button>
  );

  return (
    <div className="pointer-events-auto absolute bottom-6 left-6 z-20 h-44 w-44">
      {btn("↑", 0, 1, "left-1/2 top-0 -translate-x-1/2")}
      {btn("↓", 0, -1, "bottom-0 left-1/2 -translate-x-1/2")}
      {btn("←", -1, 0, "left-0 top-1/2 -translate-y-1/2")}
      {btn("→", 1, 0, "right-0 top-1/2 -translate-y-1/2")}
    </div>
  );
}

export function Hud() {
  const mode = useUiStore((s) => s.cameraMode);
  const room = useUiStore((s) => s.currentRoom);
  const toggle = useUiStore((s) => s.toggleCameraMode);
  const [help, setHelp] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "KeyC" && !e.repeat) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <header className="absolute left-0 right-0 top-0 flex items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2 backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber-400">Embassey</div>
          <div className="text-sm font-semibold">AI Headquarters</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm backdrop-blur">
            <MapPin className="h-4 w-4 text-amber-400" aria-hidden />
            <span>{room}</span>
          </div>
          <button
            onClick={toggle}
            className="pointer-events-auto flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-sm backdrop-blur transition hover:bg-slate-800/80"
            aria-label="Switch camera mode"
          >
            <Camera className="h-4 w-4 text-amber-400" aria-hidden />
            <span>{mode === "third-person" ? "Third person" : "Isometric"}</span>
            <kbd className="ml-1 rounded bg-white/10 px-1.5 text-xs">C</kbd>
          </button>
        </div>
      </header>

      <aside className="pointer-events-auto absolute bottom-4 right-4 w-64 rounded-xl border border-white/10 bg-slate-900/70 text-sm backdrop-blur max-sm:hidden">
        <button
          className="flex w-full items-center justify-between px-4 py-2 font-medium"
          onClick={() => setHelp((v) => !v)}
        >
          Controls
          {help ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {help && (
          <ul className="space-y-1 px-4 pb-3 text-slate-300">
            <li><kbd className="rounded bg-white/10 px-1">W A S D</kbd> move</li>
            <li><kbd className="rounded bg-white/10 px-1">Shift</kbd> run</li>
            <li>Drag mouse to look around</li>
            <li>Scroll to zoom</li>
            <li><kbd className="rounded bg-white/10 px-1">C</kbd> switch camera</li>
          </ul>
        )}
      </aside>

      <TouchPad />
    </div>
  );
}
