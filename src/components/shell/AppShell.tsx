"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode } from "react";
import { CompanyProvider } from "@/components/CompanyProvider";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { EmployeePanel } from "@/components/employees/EmployeePanel";
import { ApprovalsPage } from "@/components/pages/ApprovalsPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { TasksPage } from "@/components/pages/TasksPage";
import { SceneOverlays } from "@/components/scene/SceneOverlays";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { CommandPalette } from "./CommandPalette";
import { TopBar } from "./TopBar";

// three.js needs the browser; keep it out of the server render entirely.
const HqScene = dynamic(() => import("@/components/scene/HqScene"), { ssr: false });

class SceneBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8 text-center">
          <div className="max-w-md space-y-3">
            <h2 className="text-xl font-semibold">The 3D office could not start</h2>
            <p className="text-sm text-text-2">{this.state.error.message || "An unexpected rendering error occurred."} Check that WebGL is enabled in your browser, then reload. The chat panel still works.</p>
            <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white" onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Starfield + soft vignette behind the transparent canvas (design: main scene background). */
const SCENE_BG = [
  "radial-gradient(1.2px 1.2px at 8% 14%, rgba(255,255,255,0.5) 50%, transparent 55%)",
  "radial-gradient(1.2px 1.2px at 22% 72%, rgba(255,255,255,0.35) 50%, transparent 55%)",
  "radial-gradient(1.2px 1.2px at 37% 30%, rgba(255,255,255,0.3) 50%, transparent 55%)",
  "radial-gradient(1.2px 1.2px at 63% 88%, rgba(255,255,255,0.4) 50%, transparent 55%)",
  "radial-gradient(1.2px 1.2px at 78% 22%, rgba(255,255,255,0.35) 50%, transparent 55%)",
  "radial-gradient(1.2px 1.2px at 91% 63%, rgba(255,255,255,0.4) 50%, transparent 55%)",
  "radial-gradient(ellipse 70% 60% at 55% 52%, #171C2B 0%, #0D1017 75%)",
].join(",");

function LoadingOverlay() {
  const ready = useUiStore((s) => s.sceneReady);
  return (
    <div aria-hidden={ready} className={`pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-bg transition-opacity duration-700 ${ready ? "opacity-0" : "opacity-100"}`}>
      <div className="text-center">
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-primary-text">Embassey</div>
        <div className="mt-2 text-2xl font-semibold">AI Headquarters</div>
        <div className="mt-4 text-sm text-text-3">Entering the office…</div>
      </div>
    </div>
  );
}

function ErrorBanner() {
  const mode = useEmployeeStore((s) => s.mode);
  const error = useEmployeeStore((s) => s.error);
  if (mode !== "error") return null;
  return (
    <div role="alert" className="absolute left-1/2 top-20 z-40 w-[min(32rem,92vw)] -translate-x-1/2 rounded-xl border border-red-400/30 bg-red-950/90 p-4 text-sm text-red-100">
      <p className="font-medium">Could not load your company</p>
      <p className="mt-1 text-red-200/90">{error}</p>
      <p className="mt-2 text-xs text-red-200/70">Check that the migrations in supabase/migrations have been applied to this project.</p>
    </div>
  );
}

export function AppShell() {
  const hasPanel = useEmployeeStore((s) => s.selectedId !== null);
  const tab = useUiStore((s) => s.tab);
  return (
    <CompanyProvider>
      <div className="flex h-dvh min-h-[640px] flex-col overflow-hidden bg-bg text-text-1">
        <TopBar />
        <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
          <div className={`grid min-h-0 flex-1 grid-cols-1 lg:h-full ${hasPanel ? "lg:grid-cols-[minmax(320px,380px)_1fr_minmax(320px,360px)]" : "lg:grid-cols-[minmax(320px,380px)_1fr]"}`}>
            <ChatPanel />
            <main aria-label="3D office" className="relative min-h-[70dvh] min-w-0 overflow-hidden lg:min-h-0" style={{ background: SCENE_BG }}>
              {tab === "office" ? (
                <>
                  <SceneBoundary><HqScene /></SceneBoundary>
                  <SceneOverlays />
                  <LoadingOverlay />
                </>
              ) : tab === "tasks" ? <TasksPage /> : tab === "approvals" ? <ApprovalsPage /> : <DashboardPage />}
            </main>
            <EmployeePanel />
          </div>
          <ErrorBanner />
        </div>
        <CommandPalette />
      </div>
    </CompanyProvider>
  );
}
