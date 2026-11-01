"use client";

import { useMemo, useRef } from "react";
import { Html, Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Briefcase, Code, Home, Megaphone, Search, TrendingUp, Users, type LucideIcon } from "lucide-react";
import type { Employee, EmployeeStatus } from "@/lib/employees/types";
import { STATUS_META } from "@/lib/employees/status";
import { BRAIN, ROOMS, lookFor, roomOrigin, summarizeRoom, type RoomDef, type RoomIcon } from "@/lib/office/departments";
import { glowTexture, shade } from "./util";

/** Design-space box: (x, y) is the plan-view corner, z the base height; size is (w, d, h). Renders in design px. */
export function Box({ x, y, z = 0, w, d, h, color, emissive, emissiveIntensity = 0, opacity = 1, castShadow = true, onClick }: {
  x: number; y: number; z?: number; w: number; d: number; h: number; color: string;
  emissive?: string; emissiveIntensity?: number; opacity?: number; castShadow?: boolean; onClick?: () => void;
}) {
  return (
    <mesh position={[x + w / 2, z + h / 2, y + d / 2]} castShadow={castShadow} receiveShadow onClick={onClick}>
      <boxGeometry args={[w, h, d]} />
      <meshStandardMaterial color={color} roughness={0.85} emissive={emissive ?? "#000"} emissiveIntensity={emissiveIntensity} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

const ICONS: Record<RoomIcon, LucideIcon> = {
  home: Home, briefcase: Briefcase, megaphone: Megaphone, "trending-up": TrendingUp, code: Code, search: Search, users: Users,
};

function Plant({ x, y }: { x: number; y: number }) {
  return (
    <group position={[x, 0, y]}>
      <mesh position={[0, 4, 0]} castShadow><cylinderGeometry args={[5, 4, 8, 12]} /><meshStandardMaterial color="#F1EFEA" /></mesh>
      <mesh position={[-3, 14, 0]} castShadow><sphereGeometry args={[6, 12, 12]} /><meshStandardMaterial color="#3E9A5C" roughness={0.9} /></mesh>
      <mesh position={[3, 17, -1]} castShadow><sphereGeometry args={[6, 12, 12]} /><meshStandardMaterial color="#4FB06C" roughness={0.9} /></mesh>
      <mesh position={[0, 12, 2]} castShadow><sphereGeometry args={[6, 12, 12]} /><meshStandardMaterial color="#2F8A4E" roughness={0.9} /></mesh>
    </group>
  );
}

function Chair({ x, y, rotY = 0 }: { x: number; y: number; rotY?: number }) {
  return (
    <group position={[x, 0, y]} rotation={[0, rotY, 0]}>
      <mesh position={[0, 8, 0]} castShadow><boxGeometry args={[18, 4, 14]} /><meshStandardMaterial color="#2A2E38" /></mesh>
      <mesh position={[0, 14, 6]} castShadow><boxGeometry args={[18, 10, 3]} /><meshStandardMaterial color="#2A2E38" /></mesh>
      <mesh position={[0, 4, 0]}><cylinderGeometry args={[1.2, 1.2, 8, 8]} /><meshStandardMaterial color="#1B1E25" /></mesh>
    </group>
  );
}

/**
 * Stylised low-poly character (design: hair-coloured head, shirt body). Pose follows the REAL status:
 * only `working` bobs/types, `thinking` sways, `waiting_for_approval` turns to the camera, idle stands
 * beside the chair. Nothing here animates unless the status says so.
 */
export function Person({ employee, x, y, status, selected, onSelect, standing, ceo }: {
  employee: Pick<Employee, "id" | "slug" | "name" | "appearance">; x: number; y: number; status: EmployeeStatus;
  selected?: boolean; onSelect?: () => void; standing?: boolean; ceo?: boolean;
}) {
  const look = ceo ? { avatar: "#4F5BD5", hair: "#2A1E10", shirt: "#4F5BD5" } : lookFor(employee);
  const color = STATUS_META[status].color;
  const g = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const yaw = useRef(0);

  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.position.y = status === "working" ? Math.abs(Math.sin(t * 7)) * 0.7 : 0;
    const target = status === "waiting_for_approval" ? (3 * Math.PI) / 4 : 0;
    yaw.current += (target - yaw.current) * (1 - Math.exp(-6 * dt));
    g.current.rotation.y = yaw.current;
    if (head.current) {
      head.current.rotation.z = status === "thinking" ? Math.sin(t * 1.6) * 0.18 : 0;
      head.current.rotation.x = status === "working" ? 0.1 + Math.sin(t * 2.2) * 0.04 : 0;
    }
  });

  return (
    <group position={[x, 0, y]}>
      {selected && (
        <mesh position={[0, 0.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[17, 21, 40]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
      )}
      <group ref={g}>
        <mesh position={[0, 9.5, 0]} castShadow><capsuleGeometry args={[8, 3, 6, 12]} /><meshStandardMaterial color={look.shirt} roughness={0.8} /></mesh>
        <group ref={head} position={[0, 24, 0]}>
          <mesh castShadow><sphereGeometry args={[7, 16, 16]} /><meshStandardMaterial color={look.hair} roughness={0.9} /></mesh>
          <mesh position={[0, -1, -5.2]}><sphereGeometry args={[3, 10, 10]} /><meshStandardMaterial color="#E3BD9C" roughness={0.8} /></mesh>
        </group>
      </group>
      {/* Status dot (status colour + glow) */}
      <mesh position={[0, 43, 0]}><sphereGeometry args={[4, 12, 12]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh position={[0, 43, 0]}><sphereGeometry args={[7, 12, 12]} /><meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} toneMapped={false} /></mesh>
      {/* Generous invisible hit area */}
      <mesh position={[0, 20, 0]} onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); onSelect?.(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <capsuleGeometry args={[11, 26, 4, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {standing === undefined ? null : null}
    </group>
  );
}

/** Floating room label (HTML), anchored high on the room's back corner like the design. */
function RoomLabel({ room, count, statuses, agents, onClick }: { room: RoomDef; count: number; statuses: EmployeeStatus[]; agents: Employee[]; onClick: () => void }) {
  const { x, y } = roomOrigin(room);
  const sum = summarizeRoom(count, statuses, room.conference);
  const Icon = ICONS[room.icon];
  return (
    <Html position={[x + 100, 66, y + 18]} center zIndexRange={[20, 0]} style={{ pointerEvents: "auto" }}>
      <button onClick={onClick} aria-label={`${room.name}: ${sum.sub}. Open room`} className="flex w-[156px] items-center gap-[7px] rounded-[10px] border border-white/10 bg-[rgba(15,18,26,0.94)] px-2 py-1.5 text-left shadow-[0_6px_18px_rgba(0,0,0,0.35)] transition hover:border-white/25">
        <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md" style={{ background: room.wall }}><Icon className="h-[13px] w-[13px] text-white" strokeWidth={2.3} aria-hidden /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold leading-tight text-white">{room.name}</span>
          <span className="flex items-center gap-1 whitespace-nowrap font-mono text-[8.5px] text-text-2"><span className="inline-block h-[5px] w-[5px] rounded-full" style={{ background: sum.dot }} />{sum.sub}</span>
        </span>
        <span className="flex">{agents.map((a) => <span key={a.id} className="-ml-1 h-[13px] w-[13px] rounded-full border-[1.5px] border-[#0F121A]" style={{ background: lookFor(a).avatar }} />)}</span>
      </button>
    </Html>
  );
}

const glowMat = (color: string, opacity: number) => ({ color, map: glowTexture(), transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending } as const);

export function Room({ room, agents, statusOf, selectedId, onRoom, onAgent }: {
  room: RoomDef; agents: Employee[]; statusOf: (id: string) => EmployeeStatus; selectedId: string | null;
  onRoom: () => void; onAgent: (id: string) => void;
}) {
  const { x, y } = roomOrigin(room);
  const { wall, floor, rug } = room;
  const seats = agents.length > 1 ? [60, 92] : [76];
  const statuses = agents.map((a) => statusOf(a.id));
  const glow = useMemo(() => glowMat(wall, 0.5), [wall]);

  return (
    <group>
      {/* soft outer glow in the room colour */}
      <mesh position={[room.cx, -6.2, room.cy]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[room.w + 90, room.d + 90]} /><meshBasicMaterial {...glow} />
      </mesh>
      {/* slab (click to enter) */}
      <mesh position={[room.cx, -3, room.cy]} receiveShadow onClick={(e) => { if (e.delta > 4) return; e.stopPropagation(); onRoom(); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
        <boxGeometry args={[room.w, 6, room.d]} /><meshStandardMaterial color={floor} roughness={0.9} />
      </mesh>
      <mesh position={[x + 18 + 53, 0.4, y + 38 + 40]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[106, 80]} /><meshStandardMaterial color={rug} transparent opacity={0.42} roughness={1} />
      </mesh>

      {/* back walls: north (lighter) and east (darker), each with a bright top edge */}
      <Box x={x} y={y} w={room.w} d={4} h={44} color={shade(wall, 0.06)} />
      <Box x={x} y={y} z={43} w={room.w} d={4} h={1.2} color={shade(wall, 0.4)} castShadow={false} />
      <Box x={x + room.w - 4} y={y} w={4} d={room.d} h={44} color={shade(wall, -0.22)} />
      <Box x={x + room.w - 4} y={y} z={43} w={4} d={room.d} h={1.2} color={shade(wall, 0.3)} castShadow={false} />
      {/* wall screen */}
      <Box x={x + 84} y={y + 4} z={16} w={52} d={1} h={22} color="#0F1320" emissive={wall} emissiveIntensity={0.25} castShadow={false} />
      <mesh position={[x + 84 + 26, 27, y + 5.2]}><planeGeometry args={[34, 12]} /><meshBasicMaterial color={shade(wall, 0.35)} transparent opacity={0.35} /></mesh>

      {room.conference ? (
        <>
          <Box x={x + 38} y={y + 48} w={76} d={36} h={11} color="#EDEBE6" />
          {[48, 76, 104].map((cx) => <Chair key={`n${cx}`} x={x + cx} y={y + 46} rotY={Math.PI} />)}
          {[48, 76, 104].map((cx) => <Chair key={`s${cx}`} x={x + cx} y={y + 94} />)}
        </>
      ) : (
        <>
          <Box x={x + 40} y={y + 54} w={72} d={24} h={12} color="#EDEBE6" />
          {[48, 78].map((mx) => (
            <group key={mx}>
              <Box x={x + mx} y={y + 61} z={12} w={24} d={2} h={14} color="#151A26" emissive={wall} emissiveIntensity={0.35} castShadow={false} />
              <mesh position={[x + mx + 12, 19, y + 63.1]}><planeGeometry args={[19, 9]} /><meshBasicMaterial color={shade(wall, 0.45)} transparent opacity={0.55} /></mesh>
            </group>
          ))}
          {agents.map((a, i) => <Chair key={a.id} x={x + seats[i]} y={y + 95} />)}
          {agents.length < 2 && <Chair x={x + 100} y={y + 104} />}
          {agents.map((a, i) => {
            const st = statusOf(a.id);
            const idle = st === "idle" || st === "completed";
            return <Person key={a.id} employee={a} x={x + seats[i] + (idle ? 24 : 0)} y={y + (idle ? 104 : 90)} status={st}
              selected={selectedId === a.id} onSelect={() => onAgent(a.id)} />;
          })}
        </>
      )}

      {room.sofa && (<><Box x={x + 8} y={y + 64} w={16} d={44} h={7} color="#DAD6E3" /><Box x={x + 4} y={y + 64} w={5} d={44} h={15} color="#CBC6D6" /></>)}
      <Plant x={x + 138} y={y + 118} />
      <Plant x={x + 14} y={y + 14} />
      <RoomLabel room={room} count={agents.length} statuses={statuses} agents={agents} onClick={onRoom} />
    </group>
  );
}

/** The shared-memory hub in the middle: disc, three glowing rings, light beam and pulsing orb. */
export function Brain({ notes }: { notes: number | null }) {
  const orb = useRef<THREE.Mesh>(null);
  const halo = useMemo(() => glowMat("#7393FF", 0.55), []);
  useFrame(({ clock }) => {
    if (orb.current) orb.current.scale.setScalar(1 + Math.sin((clock.elapsedTime / 3.2) * Math.PI * 2) * 0.06);
  });
  const ring = (r: number, w: number, y: number, op: number) => (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[r - w, r, 64]} /><meshBasicMaterial color="#AACDFF" transparent opacity={op} toneMapped={false} />
    </mesh>
  );
  return (
    <group position={[BRAIN.x, 0, BRAIN.y]}>
      <mesh position={[0, -3.4, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[400, 400]} /><meshBasicMaterial {...halo} /></mesh>
      <mesh position={[0, -1, 0]} receiveShadow><cylinderGeometry args={[88, 88, 2, 64]} /><meshStandardMaterial color="#141A2C" roughness={0.8} /></mesh>
      {ring(88, 2, 0.3, 0.45)}{ring(66, 1.5, 0.6, 0.55)}{ring(44, 2, 1.2, 0.7)}
      <mesh position={[0, 1.5, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[24, 48]} /><meshBasicMaterial color="#96B9FF" transparent opacity={0.22} toneMapped={false} /></mesh>
      {Array.from({ length: 6 }, (_, i) => (
        <mesh key={i} position={[0, 15.8 + i * 31.6, 0]}>
          <cylinderGeometry args={[3, 3, 31.6, 12]} /><meshBasicMaterial color="#9CBBFF" transparent opacity={0.9 - i * 0.16} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      <mesh ref={orb} position={[0, 46, 0]}><sphereGeometry args={[24, 32, 32]} /><meshStandardMaterial color="#9DB8FF" emissive="#7393FF" emissiveIntensity={1.4} roughness={0.3} /></mesh>
      <pointLight position={[0, 60, 0]} color="#8FA8FF" intensity={9000} distance={400} decay={2} />
      <Html position={[0, 150, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-[168px] rounded-[10px] border border-[rgba(140,175,255,0.35)] bg-[rgba(13,17,27,0.92)] px-2.5 py-2 text-center font-mono">
          <div className="text-[10px] font-medium tracking-[0.22em] text-[#B7CCFF]">THE BRAIN</div>
          <div className="mt-[3px] text-[10px] text-text-2">{notes === null ? "shared memory" : `${notes.toLocaleString()} note${notes === 1 ? "" : "s"} · shared memory`}</div>
        </div>
      </Html>
    </group>
  );
}

/** Roads from the Brain to every room: dark asphalt, dashed white centre line, thin line in the room colour. */
export function Roads() {
  return (
    <group position={[BRAIN.x, 0, BRAIN.y]}>
      {ROOMS.map((r) => {
        const dx = r.cx - BRAIN.x, dy = r.cy - BRAIN.y;
        const L = Math.hypot(dx, dy);
        const ang = Math.atan2(dy, dx);
        return (
          <group key={r.key} rotation={[0, -ang, 0]}>
            <mesh position={[L / 2, -1, 0]}><boxGeometry args={[L, 2, 12]} /><meshStandardMaterial color="#1A1F2B" roughness={1} /></mesh>
            <Line points={[[0, 0.2, 0], [L, 0.2, 0]]} color="#FFFFFF" lineWidth={1} dashed dashSize={6} gapSize={8} transparent opacity={0.3} />
            <mesh position={[L / 2, 0.15, -7]}><boxGeometry args={[L, 0.3, 2]} /><meshBasicMaterial color={r.wall} transparent opacity={0.7} toneMapped={false} /></mesh>
          </group>
        );
      })}
    </group>
  );
}
