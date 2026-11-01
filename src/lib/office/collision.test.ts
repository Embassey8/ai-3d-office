import { describe, expect, it } from "vitest";
import { moveWithCollision, collides } from "./collision";
import { COLLIDERS, PLAYER_SPAWN, ROOMS, doorCentreX, roomAt, CORRIDOR, FURNITURE, furnitureRect } from "./layout";

const R = 0.35;

describe("collision", () => {
  const wall = [{ cx: 0, cz: 0, hw: 5, hd: 0.1 }];

  it("blocks movement into a wall", () => {
    const p = moveWithCollision({ x: 0, z: -1 }, 0, 2, R, wall);
    // Stops flush against the wall (wall face at -0.1, minus player radius).
    expect(p.z).toBeLessThanOrEqual(-0.1 - R + 1e-9);
    expect(p.z).toBeGreaterThan(-0.6);
  });

  it("slides along a wall", () => {
    const p = moveWithCollision({ x: 0, z: -0.6 }, 1, 1, R, wall);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.z).toBeLessThanOrEqual(-0.1 - R + 1e-9);
  });

  it("allows free movement in the open", () => {
    const p = moveWithCollision({ x: 0, z: 5 }, 1, 1, R, wall);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.z).toBeCloseTo(6, 6);
  });
});

describe("office layout", () => {
  it("spawns the player in free space inside the corridor", () => {
    expect(collides(PLAYER_SPAWN.x, PLAYER_SPAWN.z, R, COLLIDERS)).toBe(false);
    expect(roomAt(PLAYER_SPAWN.x, PLAYER_SPAWN.z)?.id).toBe("corridor");
  });

  it("lets the player walk from the corridor into every room through its door", () => {
    for (const room of ROOMS) {
      const x = doorCentreX(room);
      const wallZ = room.doorSide === "south" ? CORRIDOR.minZ : CORRIDOR.maxZ;
      const inside = room.doorSide === "south" ? wallZ - 0.8 : wallZ + 0.8;
      const outside = room.doorSide === "south" ? wallZ + 0.8 : wallZ - 0.8;
      // Walk straight through the doorway in small steps.
      let pos = { x, z: outside };
      const dir = Math.sign(inside - outside);
      for (let i = 0; i < 40; i++) pos = moveWithCollision(pos, 0, dir * 0.05, R, COLLIDERS);
      expect(roomAt(pos.x, pos.z)?.id, room.id).toBe(room.id);
    }
  });

  it("keeps the player inside the building", () => {
    const p = moveWithCollision({ x: 19.5, z: 0 }, 5, 0, R, COLLIDERS);
    expect(p.x).toBeLessThan(20);
  });

  it("places every furniture item inside the room that owns its position", () => {
    for (const f of FURNITURE) {
      expect(roomAt(f.x, f.z), f.id).not.toBeNull();
      const r = furnitureRect(f);
      expect(r.hw).toBeGreaterThan(0);
    }
  });

  it("does not place workstation desks on top of each other", () => {
    const desks = FURNITURE.filter((f) => f.workstation).map(furnitureRect);
    for (let i = 0; i < desks.length; i++) {
      for (let j = i + 1; j < desks.length; j++) {
        const a = desks[i];
        const b = desks[j];
        const overlap =
          Math.abs(a.cx - b.cx) < a.hw + b.hw && Math.abs(a.cz - b.cz) < a.hd + b.hd;
        expect(overlap, `${i} vs ${j}`).toBe(false);
      }
    }
  });
});
