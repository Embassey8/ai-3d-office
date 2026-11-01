"use client";

import { useEffect } from "react";
import { ChevronLeft, Maximize2, Minus, Plus } from "lucide-react";
import { ROOMS, agentsByRoom, modelFamily, roomByKey } from "@/lib/office/departments";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { cn } from "@/lib/utils";

const mono = "font-mono";
const glass = "bg-[rgba(16,19,26,0.92)] border border-white/[0.08]";

/** Minimap position of a room, using the design's projection (Main.dc.html). */
function mapPos(cx: number, cy: number) {
  const sx = (cx + cy) * 0.7071, sy = (cy - cx) * 0.3536;
  return { left: ((sx - 180) / 700) * 156 - 9, top: ((sy + 180) / 370) * 86 - 4.5 };
}

export function SceneOverlays() {
  const mode = useUiStore((s) => s.cameraMode);
  const setMode = useUiStore((s) => s.setCameraMode);
  const focus = useUiStore((s) => s.focusRoom);
  const focusRoomKey = useUiStore((s) => s.focusRoomKey);
  const zoomBy = useUiStore((s) => s.zoomBy);
  const zoom = useUiStore((s) => s.zoomFactor);
  const fit = useUiStore((s) => s.fit);
  const currentRoom = useUiStore((s) => s.currentRoom);
  const employees = useEmployeeStore((s) => s.employees);
  const demo = useEmployeeStore((s) => s.mode === "demo");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.code === "KeyC" && !e.repeat) useUiStore.getState().toggleCameraMode();
      if (e.code === "Escape") useUiStore.getState().focusRoomKey(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const models = [...new Set(employees.map((e) => modelFamily(e.model.name)))];
  const room = focus ? roomByKey(focus) : null;
  const roomAgents = room ? agentsByRoom(employees)[room.key] : [];
  const seg = (on: boolean) => cn("h-[30px] rounded-[7px] px-3 text-xs", on ? "bg-bubble-me text-white" : "text-text-2 hover:text-white");

  return (
    <div className="@container pointer-events-none absolute inset-0 z-10">
      <div className="pointer-events-auto absolute left-4 top-4 flex flex-wrap items-center gap-2.5">
        {room && (
          <button onClick={() => focusRoomKey(null)} className={cn("flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-xs text-[#DDE1E8]", glass)}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Back to HQ
          </button>
        )}
        <div role="group" aria-label="Camera mode" className={cn("flex rounded-[10px] p-[3px]", glass)}>
          <button aria-pressed={mode === "isometric"} className={seg(mode === "isometric")} onClick={() => setMode("isometric")}>Isometric</button>
          <button aria-pressed={mode === "third-person"} className={seg(mode === "third-person")} onClick={() => setMode("third-person")}>Third-person</button>
        </div>
        <div className={cn(mono, "text-[11px] tracking-[0.06em] text-[#9AA3B2]")}>
          {mode === "third-person" ? `${currentRoom.toUpperCase()} · WASD MOVE · DRAG ROTATE · SCROLL ZOOM` : room ? room.name.toUpperCase() : `FLOOR 1 · ${ROOMS.length} ROOMS`}
        </div>
        {demo && <div className="rounded-full border border-amber-400/30 bg-amber-950/60 px-3 py-1 text-[11px] text-amber-100">Demo mode · nothing is saved</div>}
      </div>

      {room && mode === "isometric" && (
        <div className={cn("pointer-events-auto absolute bottom-16 left-4 flex w-[264px] max-w-[calc(100%-2rem)] gap-3 rounded-[14px] px-4 py-3.5", glass)}>
          <div className="w-1 rounded-sm" style={{ background: room.wall }} />
          <div>
            <div className="text-[22px] font-bold tracking-tight">{room.name}</div>
            <div className={cn(mono, "mt-0.5 text-xs text-[#C9CED8]")}>{roomAgents.length ? roomAgents.map((a) => a.title.replace(/ (Specialist|Manager|Analyst|Representative|Rep|Developer)$/i, "")).join(" · ") : "No one here yet"}</div>
          </div>
        </div>
      )}

      <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-1.5">
        <span className={cn(mono, "mr-1 text-[10px] tracking-[0.14em] text-text-3")}>RUNS ON</span>
        {models.map((m) => <span key={m} className="rounded-[7px] border border-white/[0.08] bg-surface-4 px-[9px] py-1 text-xs">{m}</span>)}
      </div>

      <div className={cn(mono, "absolute bottom-5 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[11px] text-text-3 @[980px]:block")}>
        {mode === "isometric" ? "Click a room to enter · click an employee to chat · drag to pan · scroll to zoom" : "Click an employee to chat"}
      </div>

      <div className={cn("pointer-events-auto absolute bottom-4 right-4 flex w-44 flex-col gap-2 rounded-xl p-2.5", glass)}>
        <div className={cn(mono, "flex justify-between text-[10px] tracking-[0.12em] text-text-3")}><span>MAP</span><span>{Math.round(zoom * 100)}%</span></div>
        <div className="relative h-[86px] rounded-lg border border-white/[0.06] bg-[#0B0E14]">
          {ROOMS.map((r) => {
            const p = mapPos(r.cx, r.cy);
            return <button key={r.key} aria-label={`Go to ${r.name}`} onClick={() => focusRoomKey(r.key)} className="absolute h-[9px] w-[18px] rounded-sm" style={{ left: p.left, top: p.top, background: r.wall, outline: focus === r.key ? "1.5px solid #fff" : "none" }} />;
          })}
          <span className="absolute left-[73px] top-[39px] h-2 w-2 rounded-full bg-[#C6DAFF] shadow-[0_0_8px_#7393FF]" />
        </div>
        <div className="flex gap-1.5">
          <button aria-label="Zoom out" onClick={() => zoomBy(1 / 1.15)} className="flex h-[30px] flex-1 items-center justify-center rounded-[7px] border border-white/[0.09] bg-surface-3 text-[#DDE1E8] hover:bg-surface-4"><Minus className="h-3.5 w-3.5" /></button>
          <button aria-label="Zoom in" onClick={() => zoomBy(1.15)} className="flex h-[30px] flex-1 items-center justify-center rounded-[7px] border border-white/[0.09] bg-surface-3 text-[#DDE1E8] hover:bg-surface-4"><Plus className="h-3.5 w-3.5" /></button>
          <button aria-label="Fit office to view" onClick={fit} className="flex h-[30px] flex-1 items-center justify-center rounded-[7px] border border-white/[0.09] bg-surface-3 text-[#DDE1E8] hover:bg-surface-4"><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </div>
  );
}
