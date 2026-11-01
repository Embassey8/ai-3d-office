"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { Hud } from "@/components/hud/Hud";
import { useUiStore } from "@/store/ui";

// three.js needs the browser; keep it out of the server render entirely.
const OfficeScene = dynamic(() => import("./OfficeScene"), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-3">
            <h2 className="text-xl font-semibold">The 3D office could not start</h2>
            <p className="text-sm text-slate-300">
              {this.state.error.message || "An unexpected rendering error occurred."} Check that
              WebGL is enabled in your browser and graphics drivers are up to date, then reload.
            </p>
            <button
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-amber-400"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingOverlay() {
  const ready = useUiStore((s) => s.sceneReady);
  return (
    <div
      aria-hidden={ready}
      className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-slate-950 transition-opacity duration-700 ${
        ready ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="text-center">
        <div className="text-xs uppercase tracking-[0.35em] text-amber-400">Embassey</div>
        <div className="mt-2 text-2xl font-semibold text-white">AI Headquarters</div>
        <div className="mt-4 text-sm text-slate-400">Entering the office…</div>
      </div>
    </div>
  );
}

export function OfficeClient() {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-slate-950 text-slate-100">
      <SceneBoundary>
        <OfficeScene />
      </SceneBoundary>
      <Hud />
      <LoadingOverlay />
    </div>
  );
}
