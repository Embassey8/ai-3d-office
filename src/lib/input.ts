/**
 * Framework-agnostic input state. Written by DOM listeners / the touch pad,
 * read every frame by the camera rig. Keeping it outside React avoids
 * re-rendering on every key press.
 */
const pressed = new Set<string>();
const virtual = { x: 0, z: 0 };

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const RUN = ["ShiftLeft", "ShiftRight"];

const any = (codes: string[]) => codes.some((c) => pressed.has(c));

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

export function attachKeyboard(): () => void {
  const down = (e: KeyboardEvent) => {
    if (isTyping(e.target)) return;
    pressed.add(e.code);
  };
  const up = (e: KeyboardEvent) => pressed.delete(e.code);
  const clear = () => {
    pressed.clear();
    virtual.x = 0;
    virtual.z = 0;
  };
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", clear);
  return () => {
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", clear);
    clear();
  };
}

/** Set by the on-screen touch pad. Values are -1..1. */
export function setVirtualAxis(x: number, z: number) {
  virtual.x = x;
  virtual.z = z;
}

/** x: right (+) / left (-). z: forward (+) / back (-). */
export function getAxis() {
  let x = virtual.x;
  let z = virtual.z;
  if (any(RIGHT)) x += 1;
  if (any(LEFT)) x -= 1;
  if (any(FORWARD)) z += 1;
  if (any(BACK)) z -= 1;
  return { x, z, run: any(RUN) };
}
