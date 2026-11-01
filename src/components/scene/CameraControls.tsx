"use client";

import { useEffect, useRef } from "react";
import { OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getAxis } from "@/lib/input";
import { moveWithCollision } from "@/lib/office/collision";
import { PLAYER_SPAWN, ROOMS, collisionRects, roomAt } from "@/lib/office/departments";
import { Person } from "./parts";
import { FLOOR_CENTER, PX, toWorld } from "./util";
import { useUiStore } from "@/store/ui";

const ELEV = (30 * Math.PI) / 180; // CSS rotateX(60deg) == 30° above the horizon
/** Direction from the target to the isometric camera: south-west, looking north-east (back corner up). */
const ISO_DIR = new THREE.Vector3(-Math.cos(ELEV) / Math.SQRT2, Math.sin(ELEV), Math.cos(ELEV) / Math.SQRT2).normalize();
const RIGHT = new THREE.Vector3(1, 0, 1).normalize();     // screen-right on the floor
const FORWARD = new THREE.Vector3(1, 0, -1).normalize();  // screen-up on the floor
const RECTS = collisionRects();
const PLAYER_R = 8;

const damp = (a: number, b: number, dt: number, k = 8) => a + (b - a) * (1 - Math.exp(-k * dt));

/** Isometric (orthographic) + third-person (perspective) camera, with zoom, pan, fly-to-room and WASD walking. */
export function CameraControls() {
  const mode = useUiStore((s) => s.cameraMode);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const target = useRef(new THREE.Vector3(0, 0, 0));
  const pan = useRef(new THREE.Vector3(0, 0, 0));
  const zoom = useRef(10);
  const player = useRef<{ x: number; z: number }>({ x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z });
  const heading = useRef(0);
  const look = useRef({ yaw: Math.PI * 0.75, pitch: 0.5, dist: 40 });
  const personRef = useRef<THREE.Group>(null);
  const tmp = useRef(new THREE.Vector3());
  const lastRoom = useRef("");

  // Pointer drag (pan in iso, look in third person) and wheel zoom.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false, lx = 0, ly = 0;
    const down = (e: PointerEvent) => { dragging = true; lx = e.clientX; ly = e.clientY; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      const st = useUiStore.getState();
      if (st.cameraMode === "isometric") {
        const k = 1 / (zoom.current * 1);
        pan.current.addScaledVector(RIGHT, -dx * k).addScaledVector(FORWARD, (dy * k) / Math.sin(ELEV));
        if (Math.abs(dx) + Math.abs(dy) > 2 && st.focusRoom === null) { /* free pan */ }
      } else {
        look.current.yaw -= dx * 0.005;
        look.current.pitch = THREE.MathUtils.clamp(look.current.pitch + dy * 0.004, 0.15, 1.2);
      }
    };
    const up = (e: PointerEvent) => { dragging = false; if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId); };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const st = useUiStore.getState();
      const f = 1 - Math.sign(e.deltaY) * 0.1;
      if (st.cameraMode === "isometric") st.setZoomFactor(st.zoomFactor * f);
      else look.current.dist = THREE.MathUtils.clamp(look.current.dist / f, 8, 60);
    };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up); el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  // Fit / focus resets any manual pan.
  useEffect(() => useUiStore.subscribe((s, p) => { if (s.focusRoom !== p.focusRoom || s.fitNonce !== p.fitNonce) pan.current.set(0, 0, 0); }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const ui = useUiStore.getState();
    const cam = state.camera;

    if (ui.cameraMode === "isometric" && (cam as THREE.OrthographicCamera).isOrthographicCamera) {
      const room = ui.focusRoom ? ROOMS.find((r) => r.key === ui.focusRoom) : null;
      const goal = room ? toWorld(room.cx, room.cy) : { x: 0, z: 0 };
      target.current.x = damp(target.current.x, goal.x + pan.current.x, dt, 6);
      target.current.z = damp(target.current.z, goal.z + pan.current.z, dt, 6);
      // Fit the whole floor on screen, then apply the user's zoom (and the room close-up factor).
      const fit = Math.min(size.width / 80, size.height / 52);
      const goalZoom = fit * ui.zoomFactor * (room ? 2.2 : 1);
      zoom.current = damp(zoom.current, goalZoom, dt, 6);
      const ortho = cam as THREE.OrthographicCamera;
      cam.position.copy(target.current).addScaledVector(ISO_DIR, 80);
      cam.lookAt(target.current);
      if (Math.abs(ortho.zoom - zoom.current) > 1e-3) { ortho.zoom = zoom.current; ortho.updateProjectionMatrix(); }
    }

    if (ui.cameraMode === "third-person" && (cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const { x: ix, z: iz, run } = getAxis();
      const len = Math.hypot(ix, iz);
      const yaw = look.current.yaw;
      if (len > 0) {
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
        const nx = ix / Math.max(len, 1), nz = iz / Math.max(len, 1);
        const dx = fx * nz + rx * nx, dz = fz * nz + rz * nx;
        const speed = (run ? 140 : 80) * dt; // design px / s
        player.current = moveWithCollision(player.current, dx * speed, dz * speed, PLAYER_R, RECTS);
        heading.current = Math.atan2(dx, dz);
      }
      const pw = toWorld(player.current.x, player.current.z);
      if (personRef.current) { personRef.current.position.set(player.current.x, 0, player.current.z); personRef.current.rotation.y = heading.current + Math.PI; }
      const { pitch, dist } = look.current;
      tmp.current.set(pw.x + Math.sin(yaw) * Math.cos(pitch) * dist, 3 + Math.sin(pitch) * dist, pw.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      cam.position.lerp(tmp.current, 1 - Math.exp(-10 * dt));
      cam.lookAt(pw.x, 3, pw.z);
      const here = roomAt(player.current.x, player.current.z);
      if (here !== lastRoom.current) { lastRoom.current = here; useUiStore.getState().setCurrentRoom(here); }
    }
  });

  return (
    <>
      {mode === "isometric"
        ? <OrthographicCamera makeDefault near={-300} far={600} zoom={10} position={[-40, 30, 40]} />
        : <PerspectiveCamera makeDefault fov={50} near={0.5} far={900} position={[-10, 14, 60]} />}
      {mode === "third-person" && (
        <group scale={PX} position={[-FLOOR_CENTER, 0, -FLOOR_CENTER]}>
          <group ref={personRef} position={[PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z]}>
            <Person employee={{ id: "ceo", slug: "ceo", name: "You", appearance: { shirt: "#4F5BD5", skin: "#E3BD9C", hair: "#2A1E10" } }} x={0} y={0} status="idle" ceo />
          </group>
        </group>
      )}
    </>
  );
}
