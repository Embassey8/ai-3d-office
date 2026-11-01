import { describe, expect, it } from "vitest";
import { collides } from "./collision";
import { COLLIDERS, roomAt } from "./layout";
import { findWorkstation, workstationPoses } from "./workstations";
import { SEED_EMPLOYEES } from "../employees/seed";
import { DOOR_PASSABLE_AT, DOOR_TRIGGER_DISTANCE, closedDoorRects, doorOpen, nextDoorOpen } from "./doors";

describe("employee workstations", () => {
  it("gives every seed employee a distinct, existing workstation", () => {
    const ids = SEED_EMPLOYEES.map((e) => e.workstationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(findWorkstation(id as string), String(id)).toBeDefined();
  });

  it("has unique employee ids and the 7 required roles", () => {
    expect(new Set(SEED_EMPLOYEES.map((e) => e.id)).size).toBe(7);
    expect(SEED_EMPLOYEES.map((e) => e.title).sort()).toEqual(
      [
        "Customer Support Specialist",
        "Executive Assistant",
        "Research Analyst",
        "SEO Specialist",
        "Sales Development Representative",
        "Social Media Manager",
        "Software Developer",
      ].sort(),
    );
  });

  it("keeps seat and standing positions inside the building and clear of walls and furniture", () => {
    for (const e of SEED_EMPLOYEES) {
      const f = findWorkstation(e.workstationId as string)!;
      const { seat, stand } = workstationPoses(f, e.standSide);
      // Standing spot must be walkable and in the same room as the desk.
      expect(collides(stand.x, stand.z, 0.25, COLLIDERS), `${e.id} stand blocked`).toBe(false);
      expect(roomAt(stand.x, stand.z)?.id, `${e.id} stand room`).toBe(roomAt(f.x, f.z)?.id);
      expect(roomAt(seat.x, seat.z)?.id, `${e.id} seat room`).toBe(roomAt(f.x, f.z)?.id);
    }
  });
});

describe("doors", () => {
  it("opens when an actor is near and closes when far", () => {
    let o = 0;
    for (let i = 0; i < 30; i++) o = nextDoorOpen(o, DOOR_TRIGGER_DISTANCE - 0.1, 0.05);
    expect(o).toBe(1);
    for (let i = 0; i < 30; i++) o = nextDoorOpen(o, DOOR_TRIGGER_DISTANCE + 5, 0.05);
    expect(o).toBe(0);
  });

  it("blocks the doorway while closed and frees it once open", () => {
    expect(closedDoorRects().length).toBe(7);
    for (const k of Object.keys(doorOpen)) doorOpen[k] = 1;
    expect(closedDoorRects().length).toBe(0);
    expect(DOOR_PASSABLE_AT).toBeLessThan(1);
    for (const k of Object.keys(doorOpen)) doorOpen[k] = 0;
  });
});
