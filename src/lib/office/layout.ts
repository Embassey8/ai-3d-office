/**
 * Data-driven office layout. Coordinates are in metres on the XZ plane
 * (x = east, z = south). Everything the 3D scene renders and everything the
 * collision system uses is derived from this file, so adding a room or a
 * workstation never requires touching rendering code.
 */

export type RoomId =
  | "executive"
  | "marketing"
  | "sales"
  | "engineering"
  | "reception"
  | "conference"
  | "research";

export type FloorMaterial = "wood" | "stone" | "carpet";

export interface RoomDef {
  id: RoomId;
  name: string;
  /** Minimum corner / size on the XZ plane. */
  x: number;
  z: number;
  w: number;
  d: number;
  floor: FloorMaterial;
  /** Which side faces the corridor (and carries the doorway). */
  doorSide: "north" | "south";
}

export const OFFICE_BOUNDS = { minX: -20, maxX: 20, minZ: -14, maxZ: 14 } as const;
export const CORRIDOR = { minZ: -2, maxZ: 2 } as const;
export const WALL_HEIGHT = 3.2;
export const WALL_THICKNESS = 0.2;
export const DOOR_WIDTH = 2.4;

export const ROOMS: readonly RoomDef[] = [
  { id: "executive", name: "Executive Office", x: -20, z: -14, w: 11, d: 12, floor: "wood", doorSide: "south" },
  { id: "marketing", name: "Marketing", x: -9, z: -14, w: 11, d: 12, floor: "carpet", doorSide: "south" },
  { id: "sales", name: "Sales", x: 2, z: -14, w: 9, d: 12, floor: "carpet", doorSide: "south" },
  { id: "engineering", name: "Engineering", x: 11, z: -14, w: 9, d: 12, floor: "carpet", doorSide: "south" },
  { id: "reception", name: "Reception", x: -20, z: 2, w: 14, d: 12, floor: "stone", doorSide: "north" },
  { id: "conference", name: "Conference Room", x: -6, z: 2, w: 11, d: 12, floor: "wood", doorSide: "north" },
  { id: "research", name: "Research", x: 5, z: 2, w: 15, d: 12, floor: "carpet", doorSide: "north" },
] as const;

export type FurnitureKind =
  | "desk"
  | "executiveDesk"
  | "receptionDesk"
  | "conferenceTable"
  | "plant"
  | "sofa"
  | "screenWall";

export interface FurnitureDef {
  id: string;
  kind: FurnitureKind;
  x: number;
  z: number;
  /** Rotation around Y in radians. */
  rotY?: number;
  /** Footprint (x/z extents before rotation) used for collision. */
  w: number;
  d: number;
  /** Optional marker for desks that will host an AI employee workstation. */
  workstation?: boolean;
}

const desk = (id: string, x: number, z: number, rotY = 0): FurnitureDef => ({
  id,
  kind: "desk",
  x,
  z,
  rotY,
  w: 1.8,
  d: 0.9,
  workstation: true,
});

const plant = (id: string, x: number, z: number): FurnitureDef => ({
  id,
  kind: "plant",
  x,
  z,
  w: 0.6,
  d: 0.6,
});

export const FURNITURE: readonly FurnitureDef[] = [
  // Executive office
  { id: "ceo-desk", kind: "executiveDesk", x: -14.5, z: -9, w: 3, d: 1.4, workstation: true },
  { id: "exec-sofa", kind: "sofa", x: -17.5, z: -4.2, rotY: Math.PI, w: 2.4, d: 0.9 },
  { id: "exec-screen", kind: "screenWall", x: -14.5, z: -13.7, w: 4, d: 0.2 },
  plant("exec-plant-1", -19.2, -13.2),
  plant("exec-plant-2", -9.8, -13.2),

  // Marketing: SEO, Social, Content
  desk("mkt-seo", -6.5, -10),
  desk("mkt-social", -2.5, -10),
  desk("mkt-content", -4.5, -6),
  plant("mkt-plant", 1.2, -13.2),

  // Sales: Lead generation, Sales assistant (+ CRM dashboard wall)
  desk("sales-leads", 4.5, -10),
  desk("sales-assistant", 8.5, -10),
  { id: "crm-screen", kind: "screenWall", x: 6.5, z: -13.7, w: 4, d: 0.2 },
  plant("sales-plant", 10.2, -3),

  // Engineering: Developer, AI automation, monitoring wall
  desk("eng-dev", 13.5, -10),
  desk("eng-ai", 17.5, -10),
  { id: "eng-screen", kind: "screenWall", x: 15.5, z: -13.7, w: 4, d: 0.2 },
  plant("eng-plant", 19.2, -3),

  // Reception
  { id: "reception-desk", kind: "receptionDesk", x: -13, z: 6.5, w: 4, d: 1.2, workstation: true },
  { id: "reception-sofa", kind: "sofa", x: -17.5, z: 12.2, w: 2.4, d: 0.9 },
  plant("reception-plant-1", -19.2, 3.2),
  plant("reception-plant-2", -7.2, 3.2),
  plant("reception-plant-3", -19.2, 13),

  // Conference room
  { id: "meeting-table", kind: "conferenceTable", x: -0.5, z: 8, w: 6, d: 2.2 },
  { id: "conference-screen", kind: "screenWall", x: -0.5, z: 13.7, w: 5, d: 0.2 },
  plant("conf-plant", 4, 3.2),

  // Research: Market research, Competitor intelligence
  desk("res-market", 9.5, 7),
  desk("res-competitor", 14.5, 7),
  plant("res-plant", 19.2, 13),
];

/** Where the CEO avatar appears when entering the office. */
export const PLAYER_SPAWN = { x: -13, z: 0.5 } as const;

/* ------------------------------------------------------------------ */
/* Derived geometry                                                    */
/* ------------------------------------------------------------------ */

/** Axis-aligned rectangle on the XZ plane, defined by its centre. */
export interface Rect {
  cx: number;
  cz: number;
  hw: number; // half width (x)
  hd: number; // half depth (z)
}

export interface WallSegment extends Rect {
  /** Windows are drawn as glass; interior walls are solid. */
  kind: "solid" | "glass";
}

const rectFromBounds = (x0: number, x1: number, z0: number, z1: number): Rect => ({
  cx: (x0 + x1) / 2,
  cz: (z0 + z1) / 2,
  hw: Math.abs(x1 - x0) / 2,
  hd: Math.abs(z1 - z0) / 2,
});

/** Horizontal wall (runs along X) between x0..x1 at depth z. */
const hWall = (x0: number, x1: number, z: number, kind: WallSegment["kind"]): WallSegment => ({
  ...rectFromBounds(x0, x1, z - WALL_THICKNESS / 2, z + WALL_THICKNESS / 2),
  kind,
});

/** Vertical wall (runs along Z) between z0..z1 at x. */
const vWall = (z0: number, z1: number, x: number, kind: WallSegment["kind"]): WallSegment => ({
  ...rectFromBounds(x - WALL_THICKNESS / 2, x + WALL_THICKNESS / 2, z0, z1),
  kind,
});

/** Door gap centre for a room, on the x axis. */
export function doorCentreX(room: RoomDef): number {
  return room.x + room.w / 2;
}

function corridorWalls(): WallSegment[] {
  const segs: WallSegment[] = [];
  const build = (side: "north" | "south", z: number) => {
    const rooms = ROOMS.filter((r) => r.doorSide === (side === "north" ? "south" : "north")).sort(
      (a, b) => a.x - b.x,
    );
    for (const r of rooms) {
      const c = doorCentreX(r);
      const left = c - DOOR_WIDTH / 2;
      const right = c + DOOR_WIDTH / 2;
      segs.push(hWall(r.x, left, z, "solid"));
      segs.push(hWall(right, r.x + r.w, z, "solid"));
    }
  };
  // North rooms face the corridor through the wall at z = CORRIDOR.minZ,
  // south rooms through the wall at z = CORRIDOR.maxZ.
  build("north", CORRIDOR.minZ);
  build("south", CORRIDOR.maxZ);
  return segs;
}

function dividerWalls(): WallSegment[] {
  const segs: WallSegment[] = [];
  const northRooms = ROOMS.filter((r) => r.z < 0).sort((a, b) => a.x - b.x);
  const southRooms = ROOMS.filter((r) => r.z > 0).sort((a, b) => a.x - b.x);
  for (const row of [northRooms, southRooms]) {
    for (let i = 0; i < row.length - 1; i++) {
      const edge = row[i].x + row[i].w;
      const z0 = row[i].z;
      segs.push(vWall(z0, z0 + row[i].d, edge, "solid"));
    }
  }
  return segs;
}

function perimeterWalls(): WallSegment[] {
  const { minX, maxX, minZ, maxZ } = OFFICE_BOUNDS;
  return [
    hWall(minX, maxX, minZ, "glass"),
    hWall(minX, maxX, maxZ, "glass"),
    vWall(minZ, maxZ, minX, "glass"),
    vWall(minZ, maxZ, maxX, "glass"),
  ];
}

export const WALLS: readonly WallSegment[] = [
  ...corridorWalls(),
  ...dividerWalls(),
  ...perimeterWalls(),
];

/** Rotation-aware axis-aligned footprint for a furniture item. */
export function furnitureRect(f: FurnitureDef): Rect {
  const quarter = Math.abs(Math.round(((f.rotY ?? 0) / (Math.PI / 2)) % 2)) === 1;
  return { cx: f.x, cz: f.z, hw: (quarter ? f.d : f.w) / 2, hd: (quarter ? f.w : f.d) / 2 };
}

/** Everything the player cannot walk through. */
export const COLLIDERS: readonly Rect[] = [
  ...WALLS,
  ...FURNITURE.filter((f) => f.kind !== "screenWall" && f.kind !== "plant").map(furnitureRect),
  ...FURNITURE.filter((f) => f.kind === "plant").map((f) => ({
    cx: f.x,
    cz: f.z,
    hw: 0.25,
    hd: 0.25,
  })),
];

/** Room containing an XZ point, or the corridor, or null outside the office. */
export function roomAt(x: number, z: number): { id: RoomId | "corridor"; name: string } | null {
  for (const r of ROOMS) {
    if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return { id: r.id, name: r.name };
  }
  const { minX, maxX } = OFFICE_BOUNDS;
  if (x >= minX && x <= maxX && z >= CORRIDOR.minZ && z <= CORRIDOR.maxZ) {
    return { id: "corridor", name: "Main Corridor" };
  }
  return null;
}
