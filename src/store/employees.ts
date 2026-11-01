import { create } from "zustand";
import type { EmployeeStatus } from "@/lib/employees/types";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import { findWorkstation } from "@/lib/office/workstations";

interface EmployeeState {
  /** Runtime status per employee id. Milestone 3 replaces this with Realtime DB state. */
  statuses: Record<string, EmployeeStatus>;
  /** Ids whose status was set by the demo preview control, not by a real task. */
  previewing: Record<string, boolean>;
  selectedId: string | null;
  /** World point the third-person camera should look at (set when an employee is selected). */
  focus: { x: number; z: number } | null;
  select: (id: string | null) => void;
  clearFocus: () => void;
  setPreviewStatus: (id: string, status: EmployeeStatus | null) => void;
}

export const useEmployeeStore = create<EmployeeState>((set) => ({
  statuses: Object.fromEntries(SEED_EMPLOYEES.map((e) => [e.id, "idle" as EmployeeStatus])),
  previewing: {},
  selectedId: null,
  focus: null,
  select: (id) =>
    set(() => {
      if (!id) return { selectedId: null, focus: null };
      const emp = SEED_EMPLOYEES.find((e) => e.id === id);
      const desk = emp ? findWorkstation(emp.workstationId) : undefined;
      return { selectedId: id, focus: desk ? { x: desk.x, z: desk.z } : null };
    }),
  clearFocus: () => set({ focus: null }),
  setPreviewStatus: (id, status) =>
    set((s) => ({
      statuses: { ...s.statuses, [id]: status ?? "idle" },
      previewing: { ...s.previewing, [id]: status !== null },
    })),
}));
