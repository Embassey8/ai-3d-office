import { create } from "zustand";
import type { RoomKey } from "@/lib/office/departments";

export type CameraMode = "third-person" | "isometric";
export type AppTab = "office" | "tasks" | "approvals" | "dashboard" | "brain";

interface UiState {
  cameraMode: CameraMode;
  zoomFactor: number;
  /** Room the isometric camera is flown to (department view), or null for the whole HQ. */
  focusRoom: RoomKey | null;
  /** Bumped by "fit to view" so the camera drops manual panning. */
  fitNonce: number;
  currentRoom: string;
  sceneReady: boolean;
  /** Employee whose DM is open in the chat panel. */
  activeChatId: string | null;
  tab: AppTab;
  paletteOpen: boolean;

  setCameraMode: (m: CameraMode) => void;
  toggleCameraMode: () => void;
  setZoomFactor: (z: number) => void;
  zoomBy: (f: number) => void;
  fit: () => void;
  focusRoomKey: (k: RoomKey | null) => void;
  setCurrentRoom: (name: string) => void;
  setSceneReady: (ready: boolean) => void;
  setActiveChat: (id: string | null) => void;
  setTab: (t: AppTab) => void;
  setPaletteOpen: (open: boolean) => void;
}

const clampZoom = (z: number) => Math.min(2.4, Math.max(0.6, z));

export const useUiStore = create<UiState>((set) => ({
  cameraMode: "isometric",
  zoomFactor: 1,
  focusRoom: null,
  fitNonce: 0,
  currentRoom: "Plaza",
  sceneReady: false,
  activeChatId: null,
  tab: "office",
  paletteOpen: false,

  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleCameraMode: () => set((s) => ({ cameraMode: s.cameraMode === "third-person" ? "isometric" : "third-person" })),
  setZoomFactor: (z) => set({ zoomFactor: clampZoom(z) }),
  zoomBy: (f) => set((s) => ({ zoomFactor: clampZoom(s.zoomFactor * f) })),
  fit: () => set((s) => ({ zoomFactor: 1, focusRoom: null, fitNonce: s.fitNonce + 1 })),
  focusRoomKey: (focusRoom) => set({ focusRoom, zoomFactor: 1 }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setSceneReady: (sceneReady) => set({ sceneReady }),
  setActiveChat: (activeChatId) => set({ activeChatId }),
  setTab: (tab) => set({ tab }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));
