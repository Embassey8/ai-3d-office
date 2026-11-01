"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { COLLIDERS, PLAYER_SPAWN, roomAt } from "@/lib/office/layout";
import { moveWithCollision } from "@/lib/office/collision";
import { getAxis } from "@/lib/input";
import { useUiStore } from "@/store/ui";
import { mat } from "./materials";

const PLAYER_RADIUS = 0.35;
const WALK_SPEED = 3;
const RUN_SPEED = 5.5;
const ISO_YAW = Math.PI / 4;
const ISO_DIR = new THREE.Vector3(1, 0.8165, 1).normalize();
const MIN_DIST = 3;
const MAX_DIST = 16;

const angleLerp = (a: number, b: number, t: number) => {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * t;
};

/** Placeholder CEO avatar — replaced by a GLB character in Milestone 2. */
function PlayerAvatar({ group }: { group: React.RefObject<THREE.Group | null> }) {
  return (
    <group ref={group} position={[PLAYER_SPAWN.x, 0, PLAYER_SPAWN.z]}>
      <mesh position={[0, 0.85, 0]} material={mat.player} castShadow>
        <capsuleGeometry args={[0.26, 0.7, 6, 12]} />
      </mesh>
      <mesh position={[0, 1.58, 0]} material={mat.skin} castShadow>
        <sphereGeometry args={[0.19, 16, 16]} />
      </mesh>
      {/* Facing marker */}
      <mesh position={[0, 0.95, 0.27]} material={mat.accent}>
        <boxGeometry args={[0.2, 0.08, 0.04]} />
      </mesh>
    </group>
  );
}

/**
 * Owns the CEO avatar, movement, collision and both camera modes.
 * All per-frame state lives in refs — nothing here triggers React renders
 * except the (rare) room-name change.
 */
export function Rig() {
  const avatar = useRef<THREE.Group>(null);
  const pos = useRef<{ x: number; z: number }>({ x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z });
  const heading = useRef(Math.PI / 2);
  const look = useRef({ yaw: -Math.PI / 2, pitch: 0.42, dist: 7 });
  const isoZoom = useRef(20);
  const lastRoom = useRef("");
  const tmpTarget = useRef(new THREE.Vector3());
  const tmpDesired = useRef(new THREE.Vector3());

  const mode = useUiStore((s) => s.cameraMode);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  // Test/debug hook: exposes the player position when NEXT_PUBLIC_HQ_DEBUG=1.
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_HQ_DEBUG !== "1") return;
    const w = window as unknown as { __hq?: { getPos: () => { x: number; z: number } } };
    w.__hq = { getPos: () => ({ ...pos.current }) };
    return () => {
      delete w.__hq;
    };
  }, []);

  // Fit the whole office on screen whenever iso mode is entered or the window resizes.
  useEffect(() => {
    isoZoom.current = Math.min(size.width / 52, size.height / 34);
  }, [mode, size.width, size.height]);

  // Pointer look + wheel zoom.
  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      if (useUiStore.getState().cameraMode !== "third-person") return;
      look.current.yaw -= dx * 0.005;
      look.current.pitch = THREE.MathUtils.clamp(look.current.pitch + dy * 0.004, 0.12, 1.25);
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const dir = Math.sign(e.deltaY);
      if (useUiStore.getState().cameraMode === "third-person") {
        look.current.dist = THREE.MathUtils.clamp(look.current.dist * (1 + dir * 0.1), MIN_DIST, MAX_DIST);
      } else {
        isoZoom.current = THREE.MathUtils.clamp(isoZoom.current * (1 - dir * 0.1), 8, 80);
      }
    };

    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const cameraMode = useUiStore.getState().cameraMode;
    const yaw = cameraMode === "isometric" ? ISO_YAW : look.current.yaw;

    // --- Movement (camera-relative) ---
    const { x: ix, z: iz, run } = getAxis();
    const len = Math.hypot(ix, iz);
    if (len > 0) {
      const nx = ix / Math.max(len, 1);
      const nz = iz / Math.max(len, 1);
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      const rx = Math.cos(yaw);
      const rz = -Math.sin(yaw);
      const dirX = fx * nz + rx * nx;
      const dirZ = fz * nz + rz * nx;
      const speed = run ? RUN_SPEED : WALK_SPEED;
      pos.current = moveWithCollision(pos.current, dirX * speed * dt, dirZ * speed * dt, PLAYER_RADIUS, COLLIDERS);
      heading.current = angleLerp(heading.current, Math.atan2(dirX, dirZ), 1 - Math.exp(-14 * dt));
    }

    const g = avatar.current;
    if (g) {
      g.position.set(pos.current.x, 0, pos.current.z);
      g.rotation.y = heading.current;
    }

    // --- Current room (only touches React state on change) ---
    const room = roomAt(pos.current.x, pos.current.z)?.name ?? "Outside";
    if (room !== lastRoom.current) {
      lastRoom.current = room;
      useUiStore.getState().setCurrentRoom(room);
    }

    // --- Camera ---
    const cam = state.camera;
    if (cameraMode === "third-person" && (cam as THREE.PerspectiveCamera).isPerspectiveCamera) {
      const { pitch, dist } = look.current;
      tmpTarget.current.set(pos.current.x, 1.4, pos.current.z);
      tmpDesired.current.set(
        tmpTarget.current.x + Math.sin(yaw) * Math.cos(pitch) * dist,
        tmpTarget.current.y + Math.sin(pitch) * dist,
        tmpTarget.current.z + Math.cos(yaw) * Math.cos(pitch) * dist,
      );
      cam.position.lerp(tmpDesired.current, 1 - Math.exp(-12 * dt));
      cam.lookAt(tmpTarget.current);
    } else if (cameraMode === "isometric" && (cam as THREE.OrthographicCamera).isOrthographicCamera) {
      cam.position.copy(ISO_DIR).multiplyScalar(50);
      cam.lookAt(0, 0, 0);
      const ortho = cam as THREE.OrthographicCamera;
      const next = THREE.MathUtils.lerp(ortho.zoom, isoZoom.current, 1 - Math.exp(-10 * dt));
      if (Math.abs(next - ortho.zoom) > 1e-4) {
        ortho.zoom = next;
        ortho.updateProjectionMatrix();
      }
    }
  });

  return <PlayerAvatar group={avatar} />;
}
