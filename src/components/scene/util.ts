import * as THREE from "three";

/** Lighten (f>0) or darken (f<0) a hex colour, like the design's `sh()` helper. */
export function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const t = f < 0 ? 0 : 255;
  const p = Math.abs(f);
  const m = (c: number) => Math.round((t - c) * p + c);
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`;
}

/** World units per design pixel, and the offset that puts the 700×700 floor's centre at the origin. */
export const PX = 0.1;
export const FLOOR_CENTER = 35;
/** Design (x, y) on the floor -> world (x, z). */
export const toWorld = (x: number, y: number) => ({ x: x * PX - FLOOR_CENTER, z: y * PX - FLOOR_CENTER });

let glow: THREE.CanvasTexture | null = null;
/** Soft radial glow texture, used (additively) under rooms and the Brain. */
export function glowTexture(): THREE.CanvasTexture {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}
