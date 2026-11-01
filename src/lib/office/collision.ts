import type { Rect } from "./layout";

/**
 * Move a circle (the player) by (dx, dz) against axis-aligned rectangles.
 * Axes are resolved independently so the player slides along walls instead
 * of sticking to them. Pure function — no three.js dependency — so it is
 * unit-testable and reusable for AI employee navigation later.
 */
export function circleHitsRect(x: number, z: number, radius: number, r: Rect): boolean {
  const nx = Math.max(r.cx - r.hw, Math.min(x, r.cx + r.hw));
  const nz = Math.max(r.cz - r.hd, Math.min(z, r.cz + r.hd));
  const ddx = x - nx;
  const ddz = z - nz;
  return ddx * ddx + ddz * ddz < radius * radius;
}

export function collides(x: number, z: number, radius: number, rects: readonly Rect[]): boolean {
  for (const r of rects) if (circleHitsRect(x, z, radius, r)) return true;
  return false;
}

/** Largest distance moved in one collision step; prevents tunnelling through thin walls. */
const MAX_STEP = 0.1;

export function moveWithCollision(
  pos: { x: number; z: number },
  dx: number,
  dz: number,
  radius: number,
  rects: readonly Rect[],
): { x: number; z: number } {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_STEP));
  const sx = dx / steps;
  const sz = dz / steps;
  let { x, z } = pos;
  for (let i = 0; i < steps; i++) {
    if (!collides(x + sx, z, radius, rects)) x += sx;
    if (!collides(x, z + sz, radius, rects)) z += sz;
  }
  return { x, z };
}
