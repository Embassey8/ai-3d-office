import { FURNITURE, type FurnitureDef } from "./layout";

export interface Pose {
  x: number;
  z: number;
  /** Yaw in radians; the avatar model faces +Z at yaw 0. */
  yaw: number;
}

export interface WorkstationPoses {
  seat: Pose;
  stand: Pose;
}

/** Local desk space (x right, z toward the chair) -> world space. */
function toWorld(f: FurnitureDef, lx: number, lz: number) {
  const r = f.rotY ?? 0;
  return {
    x: f.x + lx * Math.cos(r) + lz * Math.sin(r),
    z: f.z - lx * Math.sin(r) + lz * Math.cos(r),
  };
}

/**
 * Where an employee sits and where they stand when not at their desk.
 * The desk's chair sits at +Z in local space, so the seated avatar faces -Z.
 */
export function workstationPoses(f: FurnitureDef, standSide: 1 | -1 = 1): WorkstationPoses {
  const r = f.rotY ?? 0;
  const seat = toWorld(f, 0, f.d / 2 + 0.5);
  const stand = toWorld(f, standSide * 1.3, f.d / 2 + 0.7);
  return {
    seat: { ...seat, yaw: r + Math.PI },
    stand: { ...stand, yaw: r + Math.PI },
  };
}

export function findWorkstation(id: string): FurnitureDef | undefined {
  return FURNITURE.find((f) => f.id === id && f.workstation);
}
