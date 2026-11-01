import { CORRIDOR, DOOR_WIDTH, ROOMS, WALL_THICKNESS, doorCentreX, type Rect, type RoomId } from "./layout";

export interface DoorDef {
  roomId: RoomId;
  x: number;
  z: number;
}

export const DOORS: readonly DoorDef[] = ROOMS.map((r) => ({
  roomId: r.id,
  x: doorCentreX(r),
  z: r.doorSide === "south" ? CORRIDOR.minZ : CORRIDOR.maxZ,
}));

export const DOOR_TRIGGER_DISTANCE = 2.3;
/** Fully-open fraction above which the doorway is treated as passable. */
export const DOOR_PASSABLE_AT = 0.85;
const OPEN_SPEED = 3; // fraction per second

/** Next open fraction (0 closed .. 1 open) for a door given the nearest actor distance. */
export function nextDoorOpen(current: number, actorDistance: number, dt: number): number {
  const target = actorDistance <= DOOR_TRIGGER_DISTANCE ? 1 : 0;
  const step = OPEN_SPEED * dt;
  if (target > current) return Math.min(target, current + step);
  return Math.max(target, current - step);
}

/** Live door state; mutated per frame by the rig, read by door meshes. */
export const doorOpen: Record<string, number> = Object.fromEntries(DOORS.map((d) => [d.roomId, 0]));

export function updateDoors(px: number, pz: number, dt: number) {
  for (const d of DOORS) {
    const dist = Math.hypot(px - d.x, pz - d.z);
    doorOpen[d.roomId] = nextDoorOpen(doorOpen[d.roomId], dist, dt);
  }
}

const doorRect = (d: DoorDef): Rect => ({
  cx: d.x,
  cz: d.z,
  hw: DOOR_WIDTH / 2,
  hd: WALL_THICKNESS / 2,
});

const DOOR_RECTS = DOORS.map(doorRect);

/** Colliders for doors that are not yet open enough to walk through. */
export function closedDoorRects(): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < DOORS.length; i++) {
    if (doorOpen[DOORS[i].roomId] < DOOR_PASSABLE_AT) out.push(DOOR_RECTS[i]);
  }
  return out;
}
