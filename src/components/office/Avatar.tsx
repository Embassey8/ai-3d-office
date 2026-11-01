"use client";

import { useMemo, useRef } from "react";
import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { Employee } from "@/lib/employees/types";
import { STATUS_META, isAtDesk, isTyping } from "@/lib/employees/status";
import { findWorkstation, workstationPoses } from "@/lib/office/workstations";
import { roomAt } from "@/lib/office/layout";
import { useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";

const WALK_SPEED = 1.1;
const damp = (cur: number, target: number, dt: number, rate = 10) =>
  cur + (target - cur) * (1 - Math.exp(-rate * dt));
const angleDamp = (cur: number, target: number, dt: number, rate = 10) => {
  const d = Math.atan2(Math.sin(target - cur), Math.cos(target - cur));
  return cur + d * (1 - Math.exp(-rate * dt));
};

/**
 * Procedural humanoid. Pose follows the employee's REAL status from the store:
 * only `working` produces the typing animation, and the avatar only sits at the
 * desk for statuses where the employee is at their workstation.
 */
export function Avatar({ employee }: { employee: Employee }) {
  const desk = findWorkstation(employee.workstationId);
  const poses = useMemo(
    () => (desk ? workstationPoses(desk, employee.standSide) : null),
    [desk, employee.standSide],
  );

  const status = useEmployeeStore((s) => s.statuses[employee.id]);
  const previewing = useEmployeeStore((s) => !!s.previewing[employee.id]);
  const selected = useEmployeeStore((s) => s.selectedId === employee.id);
  const select = useEmployeeStore((s) => s.select);

  const mats = useMemo(
    () => ({
      shirt: new THREE.MeshStandardMaterial({ color: employee.appearance.shirt, roughness: 0.8 }),
      skin: new THREE.MeshStandardMaterial({ color: employee.appearance.skin, roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: employee.appearance.hair, roughness: 0.9 }),
      trousers: new THREE.MeshStandardMaterial({ color: "#2b3038", roughness: 0.9 }),
    }),
    [employee.appearance],
  );

  const root = useRef<THREE.Group>(null);
  const hips = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const foreL = useRef<THREE.Group>(null);
  const foreR = useRef<THREE.Group>(null);
  const thighL = useRef<THREE.Group>(null);
  const thighR = useRef<THREE.Group>(null);
  const shinL = useRef<THREE.Group>(null);
  const shinR = useRef<THREE.Group>(null);
  const cur = useRef<{ x: number; z: number; yaw: number } | null>(null);
  const walkPhase = useRef(0);
  const label = useRef<HTMLDivElement>(null);

  useFrame(({ clock }, delta) => {
    if (!poses || !root.current) return;
    const dt = Math.min(delta, 0.05);
    const t = clock.elapsedTime;
    const s = useEmployeeStore.getState().statuses[employee.id];
    const atDesk = isAtDesk(s);
    const target = atDesk ? poses.seat : poses.stand;

    // Start already in place (idle employees start standing at their stand spot).
    cur.current ??= { x: poses.stand.x, z: poses.stand.z, yaw: poses.stand.yaw };
    const c = cur.current;

    const dx = target.x - c.x;
    const dz = target.z - c.z;
    const dist = Math.hypot(dx, dz);
    const walking = dist > 0.04;
    if (walking) {
      const step = Math.min(dist, WALK_SPEED * dt);
      c.x += (dx / dist) * step;
      c.z += (dz / dist) * step;
      c.yaw = angleDamp(c.yaw, Math.atan2(dx, dz), dt, 12);
      walkPhase.current += dt * 7;
    } else {
      c.yaw = angleDamp(c.yaw, target.yaw, dt, 8);
    }
    const seated = atDesk && !walking;
    const typing = seated && isTyping(s);
    const thinking = seated && s === "thinking";

    root.current.position.set(c.x, 0, c.z);
    root.current.rotation.y = c.yaw;

    const swing = walking ? Math.sin(walkPhase.current) : 0;
    const set = (g: THREE.Group | null, rx: number, rate = 12) => {
      if (g) g.rotation.x = damp(g.rotation.x, rx, dt, rate);
    };

    if (hips.current) hips.current.position.y = damp(hips.current.position.y, seated ? 0.56 : 0.92, dt, 14);
    set(thighL.current, seated ? -Math.PI / 2 : swing * 0.6);
    set(thighR.current, seated ? -Math.PI / 2 : -swing * 0.6);
    set(shinL.current, seated ? Math.PI / 2 : Math.max(0, -swing) * 0.7);
    set(shinR.current, seated ? Math.PI / 2 : Math.max(0, swing) * 0.7);

    const kbL = typing ? Math.sin(t * 13) * 0.07 : 0;
    const kbR = typing ? Math.sin(t * 13 + 2) * 0.07 : 0;
    set(armL.current, seated ? -0.75 : -swing * 0.5);
    set(armR.current, thinking ? -1.3 : seated ? -0.75 : swing * 0.5);
    set(foreL.current, seated ? -0.95 + kbL : 0);
    set(foreR.current, thinking ? -2.0 : seated ? -0.95 + kbR : 0);

    if (head.current) {
      const nod = typing ? Math.sin(t * 2.2) * 0.04 : 0;
      head.current.rotation.x = damp(head.current.rotation.x, (seated ? 0.12 : 0) + nod, dt);
      head.current.rotation.z = damp(head.current.rotation.z, thinking ? Math.sin(t * 0.9) * 0.1 : 0, dt);
    }
    // Labels would show through walls, so in first/third-person view only label
    // employees in the player's current room (or the selected one).
    if (label.current) {
      const ui = useUiStore.getState();
      const here = roomAt(c.x, c.z)?.name;
      const visible =
        ui.cameraMode === "isometric" ||
        here === ui.currentRoom ||
        useEmployeeStore.getState().selectedId === employee.id;
      const display = visible ? "" : "none";
      if (label.current.style.display !== display) label.current.style.display = display;
    }
    if (torso.current) torso.current.scale.y = 1 + (walking ? 0 : Math.sin(t * 1.6) * 0.012);
  });

  if (!desk || !poses) return null;
  const meta = STATUS_META[status];

  return (
    <group
      ref={root}
      position={[poses.stand.x, 0, poses.stand.z]}
      onClick={(e) => {
        if (e.delta > 4) return; // it was a camera drag, not a click
        e.stopPropagation();
        select(employee.id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "";
      }}
    >
      {/* Generous invisible hit area so avatars are easy to click */}
      <mesh position={[0, 0.9, 0]}>
        <capsuleGeometry args={[0.38, 0.9, 4, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.5, 0.62, 32]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      )}

      <group ref={hips} position={[0, 0.92, 0]}>
        <mesh ref={torso} position={[0, 0.3, 0]} material={mats.shirt} castShadow>
          <boxGeometry args={[0.38, 0.56, 0.2]} />
        </mesh>
        <group ref={head} position={[0, 0.62, 0]}>
          <mesh position={[0, 0.13, 0]} material={mats.skin} castShadow>
            <sphereGeometry args={[0.13, 16, 16]} />
          </mesh>
          <mesh position={[0, 0.18, -0.02]} scale={[1, 0.8, 1.05]} material={mats.hair} castShadow>
            <sphereGeometry args={[0.14, 16, 16]} />
          </mesh>
        </group>

        {/* Arms */}
        {([
          [-0.26, armL, foreL],
          [0.26, armR, foreR],
        ] as const).map(([x, a, f]) => (
          <group key={x} ref={a} position={[x, 0.52, 0]}>
            <mesh position={[0, -0.14, 0]} material={mats.shirt} castShadow>
              <boxGeometry args={[0.1, 0.3, 0.1]} />
            </mesh>
            <group ref={f} position={[0, -0.29, 0]}>
              <mesh position={[0, -0.13, 0]} material={mats.skin} castShadow>
                <boxGeometry args={[0.085, 0.28, 0.085]} />
              </mesh>
            </group>
          </group>
        ))}

        {/* Legs */}
        {([
          [-0.1, thighL, shinL],
          [0.1, thighR, shinR],
        ] as const).map(([x, th, sh]) => (
          <group key={x} ref={th} position={[x, 0.02, 0]}>
            <mesh position={[0, -0.22, 0]} material={mats.trousers} castShadow>
              <boxGeometry args={[0.15, 0.44, 0.15]} />
            </mesh>
            <group ref={sh} position={[0, -0.45, 0]}>
              <mesh position={[0, -0.22, 0]} material={mats.trousers} castShadow>
                <boxGeometry args={[0.13, 0.44, 0.13]} />
              </mesh>
              <mesh position={[0, -0.46, 0.05]} material={mats.hair} castShadow>
                <boxGeometry args={[0.14, 0.06, 0.26]} />
              </mesh>
            </group>
          </group>
        ))}
      </group>

      {/* Status label (always reflects the real status; "preview" is flagged) */}
      <Html position={[0, 2.05, 0]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div ref={label} className="whitespace-nowrap rounded-lg border border-white/10 bg-slate-900/80 px-2 py-1 text-center text-[11px] leading-tight text-white shadow backdrop-blur">
          <div className="font-medium">{employee.name}</div>
          <div className="flex items-center justify-center gap-1 text-slate-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
            {meta.label}
            {previewing && <span className="ml-1 rounded bg-amber-500/20 px-1 text-amber-300">preview</span>}
          </div>
        </div>
      </Html>
    </group>
  );
}
