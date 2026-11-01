import { describe, expect, it } from "vitest";
import { collides, moveWithCollision } from "./collision";

describe("collision", () => {
  const wall = [{ cx: 0, cz: 0, hw: 5, hd: 0.1 }];
  it("blocks movement into a wall without tunnelling at large steps", () => {
    const p = moveWithCollision({ x: 0, z: -1 }, 0, 2, 0.35, wall);
    expect(p.z).toBeLessThanOrEqual(-0.1 - 0.35 + 1e-9);
  });
  it("slides along a wall", () => {
    const p = moveWithCollision({ x: 0, z: -0.6 }, 1, 1, 0.35, wall);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.z).toBeLessThanOrEqual(-0.45 + 1e-9);
  });
  it("allows free movement in the open and reports overlaps", () => {
    const p = moveWithCollision({ x: 0, z: 5 }, 1, 1, 0.35, wall);
    expect(p.x).toBeCloseTo(1, 6); expect(p.z).toBeCloseTo(6, 6);
    expect(collides(0, 0, 0.35, wall)).toBe(true);
  });
});
