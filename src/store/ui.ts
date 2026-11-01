import { create } from "zustand";

export type CameraMode = "third-person" | "isometric";

interface UiState {
  cameraMode: CameraMode;
  currentRoom: string;
  sceneReady: boolean;
  setCameraMode: (m: CameraMode) => void;
  toggleCameraMode: () => void;
  setCurrentRoom: (name: string) => void;
  setSceneReady: (ready: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  cameraMode: "third-person",
  currentRoom: "Main Corridor",
  sceneReady: false,
  setCameraMode: (cameraMode) => set({ cameraMode }),
  toggleCameraMode: () =>
    set((s) => ({ cameraMode: s.cameraMode === "third-person" ? "isometric" : "third-person" })),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setSceneReady: (sceneReady) => set({ sceneReady }),
}));
