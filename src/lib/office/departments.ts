/**
 * Data-driven HQ layout, taken from design/design-source/Main.dc.html.
 * Coordinates are DESIGN PIXELS on a 700×700 floor (x east, y south); the scene renders them at 0.1 world
 * units per pixel. Adding a department is adding a row here (later: a `departments` table row).
 */
import type { Employee, EmployeeStatus } from "@/lib/employees/types";

export type RoomKey = "reception" | "sales" | "marketing" | "executive" | "research" | "engineering" | "conference";
export type RoomIcon = "home" | "briefcase" | "megaphone" | "trending-up" | "code" | "search" | "users";

export interface RoomDef {
  key: RoomKey;
  name: string;
  cx: number;
  cy: number;
  w: number;
  d: number;
  wall: string;
  floor: string;
  rug: string;
  icon: RoomIcon;
  sofa?: boolean;
  conference?: boolean;
  /** Database department names that belong in this room. */
  departments: string[];
}

export const FLOOR_SIZE = 700;
export const BRAIN = { x: 350, y: 350, radius: 88 } as const;
export const ROOM_W = 150;
export const ROOM_D = 130;

export const ROOMS: readonly RoomDef[] = [
  { key: "reception", name: "Reception", cx: 169.7, cy: 530.3, w: ROOM_W, d: ROOM_D, wall: "#6E7684", floor: "#575E6A", rug: "#B5BBC5", icon: "home", sofa: true, departments: ["Reception", "Customer Support"] },
  { key: "sales", name: "Sales", cx: 96.6, cy: 321.5, w: ROOM_W, d: ROOM_D, wall: "#C5463F", floor: "#A43A34", rug: "#EDB2AD", icon: "trending-up", departments: ["Sales"] },
  { key: "marketing", name: "Marketing", cx: 214.3, cy: 134.1, w: ROOM_W, d: ROOM_D, wall: "#A04CC0", floor: "#8A40A6", rug: "#DDB3EC", icon: "megaphone", sofa: true, departments: ["Marketing"] },
  { key: "executive", name: "Executive", cx: 434.2, cy: 109.3, w: ROOM_W, d: ROOM_D, wall: "#C98A3E", floor: "#A9732F", rug: "#EED3A6", icon: "briefcase", departments: ["Executive"] },
  { key: "research", name: "Research", cx: 590.7, cy: 265.8, w: ROOM_W, d: ROOM_D, wall: "#3F68C2", floor: "#3459A8", rug: "#AFC3EE", icon: "search", departments: ["Research"] },
  { key: "engineering", name: "Engineering", cx: 565.9, cy: 485.7, w: ROOM_W, d: ROOM_D, wall: "#2F8F5A", floor: "#287A4D", rug: "#ADDDC0", icon: "code", departments: ["Engineering"] },
  { key: "conference", name: "Conference", cx: 378.5, cy: 603.4, w: ROOM_W, d: ROOM_D, wall: "#278C84", floor: "#227870", rug: "#A9DED9", icon: "users", conference: true, departments: ["Conference"] },
];

export const roomByKey = (k: RoomKey) => ROOMS.find((r) => r.key === k)!;
/** Top-left corner of a room's slab. */
export const roomOrigin = (r: RoomDef) => ({ x: r.cx - r.w / 2, y: r.cy - r.d / 2 });

export function roomForDepartment(department: string): RoomKey {
  return ROOMS.find((r) => r.departments.includes(department))?.key ?? "reception";
}

/** Per-employee look from the design (Main.dc.html), keyed by the stable employee slug. */
export const DESIGN_LOOK: Record<string, { avatar: string; hair: string; shirt: string }> = {
  "exec-assistant": { avatar: "#D89A4A", hair: "#2C1A12", shirt: "#2E3A5C" },
  seo: { avatar: "#B05BD0", hair: "#1A1311", shirt: "#7FB7FF" },
  social: { avatar: "#D59AE8", hair: "#3A2216", shirt: "#F2EEE8" },
  sdr: { avatar: "#D9574F", hair: "#1E1410", shirt: "#F2C14E" },
  support: { avatar: "#8B8F98", hair: "#2B1B14", shirt: "#E2E5EA" },
  dev: { avatar: "#3FA56B", hair: "#121212", shirt: "#3B4256" },
  research: { avatar: "#4C7BD9", hair: "#8A4B2A", shirt: "#E9E4F5" },
};

export interface AgentLook { avatar: string; hair: string; shirt: string }
export const lookFor = (e: Pick<Employee, "slug" | "appearance">): AgentLook => {
  const d = DESIGN_LOOK[e.slug];
  return { avatar: d?.avatar ?? e.appearance.avatar ?? e.appearance.shirt, hair: d?.hair ?? e.appearance.hair, shirt: d?.shirt ?? e.appearance.shirt };
};

/** Chat/UI model chip: "Opus" | "Sonnet" | "Haiku" | model name. */
export function modelFamily(modelName: string): string {
  const m = /claude-(opus|sonnet|haiku|fable|mythos)/.exec(modelName);
  return m ? m[1][0].toUpperCase() + m[1].slice(1) : modelName;
}

export function agentsByRoom(employees: readonly Employee[]): Record<RoomKey, Employee[]> {
  const out = Object.fromEntries(ROOMS.map((r) => [r.key, [] as Employee[]])) as Record<RoomKey, Employee[]>;
  for (const e of employees) out[roomForDepartment(e.department)].push(e);
  return out;
}

export interface RoomSummary { sub: string; dot: string; counts: Record<string, number> }

const DOT = { working: "#3DDC84", approval: "#FF8A3D", thinking: "#F5B841", error: "#FF5A5F", idle: "#8A93A3" } as const;

/** "2 agents · 1 approval" etc. Computed from real statuses; never invented. */
export function summarizeRoom(count: number, statuses: EmployeeStatus[], conference = false): RoomSummary {
  const c = (s: EmployeeStatus) => statuses.filter((x) => x === s).length;
  const counts = { working: c("working"), approval: c("waiting_for_approval"), thinking: c("thinking"), error: c("error") };
  if (count === 0) return { sub: conference ? "No meeting" : "Empty", dot: DOT.idle, counts };
  const n = `${count} agent${count === 1 ? "" : "s"}`;
  const tail = counts.approval ? `${counts.approval} approval${counts.approval === 1 ? "" : "s"}`
    : counts.working ? `${counts.working} working`
    : counts.thinking ? "thinking"
    : counts.error ? "error"
    : "idle";
  const dot = counts.working ? DOT.working : counts.approval ? DOT.approval : counts.thinking ? DOT.thinking : counts.error ? DOT.error : DOT.idle;
  return { sub: `${n} · ${tail}`, dot, counts };
}

/* ---- Third-person walking: collision geometry (design px, axis-aligned, centre + half extents) ---- */
export interface Rect { cx: number; cz: number; hw: number; hd: number }
const WALL_T = 4;

/** Back (north) and side (east) wall of every room, plus the Brain pedestal. */
export function collisionRects(): Rect[] {
  const rects: Rect[] = [];
  for (const r of ROOMS) {
    const { x, y } = roomOrigin(r);
    rects.push({ cx: x + r.w / 2, cz: y + WALL_T / 2, hw: r.w / 2, hd: WALL_T / 2 });          // north wall
    rects.push({ cx: x + r.w - WALL_T / 2, cz: y + r.d / 2, hw: WALL_T / 2, hd: r.d / 2 });   // east wall
    // desk
    rects.push({ cx: x + 40 + 36, cz: y + 54 + 12, hw: 36, hd: 12 });
  }
  rects.push({ cx: BRAIN.x, cz: BRAIN.y, hw: 30, hd: 30 });
  return rects;
}

/** Where the CEO appears in third-person mode: on the plaza south of the Brain, between roads. */
export const PLAYER_SPAWN = { x: 350, z: 450 } as const;

/** Name of the room containing a floor point (design px), "Plaza" on the roads / around the Brain. */
export function roomAt(x: number, z: number): string {
  for (const r of ROOMS) if (Math.abs(x - r.cx) <= r.w / 2 && Math.abs(z - r.cy) <= r.d / 2) return r.name;
  return Math.hypot(x - BRAIN.x, z - BRAIN.y) <= BRAIN.radius ? "The Brain" : "Plaza";
}
