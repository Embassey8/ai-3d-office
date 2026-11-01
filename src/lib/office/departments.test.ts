import { describe, expect, it } from "vitest";
import { collides, moveWithCollision } from "./collision";
import { BRAIN, PLAYER_SPAWN, ROOMS, agentsByRoom, collisionRects, modelFamily, roomForDepartment, summarizeRoom } from "./departments";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";

describe("HQ layout (from the design)", () => {
  it("has the seven rooms of the design on a ring of radius ~255 around the Brain", () => {
    expect(ROOMS.map((r) => r.name)).toEqual(["Reception", "Sales", "Marketing", "Executive", "Research", "Engineering", "Conference"]);
    for (const r of ROOMS) expect(Math.hypot(r.cx - BRAIN.x, r.cy - BRAIN.y)).toBeCloseTo(255, 0);
  });
  it("spaces the rooms 360/7 degrees apart", () => {
    const angles = ROOMS.map((r) => (Math.atan2(r.cy - BRAIN.y, r.cx - BRAIN.x) * 180) / Math.PI).sort((a, b) => a - b);
    for (let i = 1; i < angles.length; i++) expect(angles[i] - angles[i - 1]).toBeCloseTo(360 / 7, 0);
  });
  it("keeps every room inside the 700×700 floor and rooms from overlapping", () => {
    for (const r of ROOMS) {
      expect(r.cx - r.w / 2).toBeGreaterThanOrEqual(0); expect(r.cx + r.w / 2).toBeLessThanOrEqual(700);
      expect(r.cy - r.d / 2).toBeGreaterThanOrEqual(0); expect(r.cy + r.d / 2).toBeLessThanOrEqual(700);
    }
    for (let i = 0; i < ROOMS.length; i++) for (let j = i + 1; j < ROOMS.length; j++) {
      const a = ROOMS[i], b = ROOMS[j];
      expect(Math.abs(a.cx - b.cx) < a.w / 2 + b.w / 2 && Math.abs(a.cy - b.cy) < a.d / 2 + b.d / 2, `${a.key}/${b.key}`).toBe(false);
    }
  });
});

describe("room assignment", () => {
  it("places the design team in their rooms", () => {
    const by = agentsByRoom(SEED_EMPLOYEES);
    expect(by.marketing.map((e) => e.name)).toEqual(["Femi", "Zara"]);
    expect(by.reception.map((e) => e.name)).toEqual(["Nneka"]);
    expect(by.executive.map((e) => e.name)).toEqual(["Ada"]);
    expect(by.conference).toEqual([]);
  });
  it("maps database department names (incl. Customer Support) and falls back to Reception", () => {
    expect(roomForDepartment("Customer Support")).toBe("reception");
    expect(roomForDepartment("Engineering")).toBe("engineering");
    expect(roomForDepartment("Unknown dept")).toBe("reception");
  });
  it("summarises rooms from real statuses", () => {
    expect(summarizeRoom(1, ["idle"]).sub).toBe("1 agent · idle");
    expect(summarizeRoom(1, ["working"]).sub).toBe("1 agent · 1 working");
    expect(summarizeRoom(2, ["working", "waiting_for_approval"]).sub).toBe("2 agents · 1 approval");
    expect(summarizeRoom(1, ["thinking"]).sub).toBe("1 agent · thinking");
    expect(summarizeRoom(0, [], true).sub).toBe("No meeting");
    expect(summarizeRoom(2, ["working", "waiting_for_approval"]).dot).toBe("#3DDC84");
  });
  it("derives the model chip", () => {
    expect(modelFamily("claude-opus-5-5")).toBe("Opus");
    expect(modelFamily("claude-haiku-5-5")).toBe("Haiku");
    expect(modelFamily("gpt-x")).toBe("gpt-x");
  });
});

describe("third-person collision", () => {
  const rects = collisionRects();
  it("spawns the CEO in free space", () => {
    expect(collides(PLAYER_SPAWN.x, PLAYER_SPAWN.z, 8, rects)).toBe(false);
  });
  it("blocks walking through the Brain pedestal and a room's back wall", () => {
    const toBrain = moveWithCollision({ x: 350, z: 450 }, 0, -200, 8, rects);
    expect(toBrain.z).toBeGreaterThan(BRAIN.y + 30);
    const exec = ROOMS.find((r) => r.key === "executive")!;
    const intoWall = moveWithCollision({ x: exec.cx, z: exec.cy }, 0, -200, 8, rects);
    expect(intoWall.z).toBeGreaterThan(exec.cy - exec.d / 2);
  });
});
