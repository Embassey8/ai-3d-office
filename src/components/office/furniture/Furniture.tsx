import { mat } from "../materials";
import { SEED_EMPLOYEES } from "@/lib/employees/seed";
import { screenIsOn } from "@/lib/employees/status";
import { useEmployeeStore } from "@/store/employees";
import type { FurnitureDef } from "@/lib/office/layout";

type P = { position?: [number, number, number]; rotation?: [number, number, number] };

const Box = ({
  size,
  position,
  material,
  cast = true,
}: {
  size: [number, number, number];
  position: [number, number, number];
  material: import("three").Material;
  cast?: boolean;
}) => (
  <mesh position={position} material={material} castShadow={cast} receiveShadow>
    <boxGeometry args={size} />
  </mesh>
);

export function Chair({ position = [0, 0, 0], rotation = [0, 0, 0] }: P) {
  return (
    <group position={position} rotation={rotation}>
      <Box size={[0.5, 0.08, 0.5]} position={[0, 0.48, 0]} material={mat.chair} />
      <Box size={[0.5, 0.55, 0.07]} position={[0, 0.78, 0.22]} material={mat.chair} />
      <mesh position={[0, 0.24, 0]} material={mat.metal} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.46, 8]} />
      </mesh>
      <mesh position={[0, 0.03, 0]} material={mat.metal}>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 12]} />
      </mesh>
    </group>
  );
}

function Monitor({ position, rotY = 0, on = true }: { position: [number, number, number]; rotY?: number; on?: boolean }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <Box size={[0.62, 0.38, 0.03]} position={[0, 0.2, 0]} material={mat.metal} />
      <mesh position={[0, 0.2, 0.017]} material={on ? mat.screenGlow : mat.screenOff}>
        <planeGeometry args={[0.56, 0.32]} />
      </mesh>
      <Box size={[0.06, 0.16, 0.06]} position={[0, 0.02, -0.02]} material={mat.metal} />
    </group>
  );
}

/** Standard workstation: desk + monitor + keyboard + chair. Desk faces +Z (chair side). */
export function Desk({ w, d, screenOn = true }: { w: number; d: number; screenOn?: boolean }) {
  return (
    <group>
      <Box size={[w, 0.06, d]} position={[0, 0.74, 0]} material={mat.wood} />
      <Box size={[0.06, 0.72, d - 0.1]} position={[-w / 2 + 0.05, 0.36, 0]} material={mat.woodDark} />
      <Box size={[0.06, 0.72, d - 0.1]} position={[w / 2 - 0.05, 0.36, 0]} material={mat.woodDark} />
      <Monitor position={[0, 0.77, -d / 4]} on={screenOn} />
      <Box size={[0.42, 0.02, 0.14]} position={[0, 0.78, d / 5]} material={mat.metal} cast={false} />
      <Chair position={[0, 0, d / 2 + 0.55]} />
    </group>
  );
}

export function ExecutiveDesk({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <Box size={[w, 0.08, d]} position={[0, 0.76, 0]} material={mat.woodDark} />
      <Box size={[w - 0.2, 0.7, 0.06]} position={[0, 0.38, -d / 2 + 0.1]} material={mat.wood} />
      <Monitor position={[-0.55, 0.8, -0.2]} />
      <Monitor position={[0.55, 0.8, -0.2]} />
      <Box size={[0.5, 0.02, 0.16]} position={[0, 0.81, 0.25]} material={mat.metal} cast={false} />
      <Chair position={[0, 0, d / 2 + 0.7]} />
    </group>
  );
}

export function ReceptionDesk({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <Box size={[w, 1.05, d]} position={[0, 0.525, 0]} material={mat.stone} />
      <Box size={[w + 0.1, 0.06, d + 0.1]} position={[0, 1.08, 0]} material={mat.woodDark} />
      <mesh position={[0, 0.6, d / 2 + 0.01]} material={mat.accent}>
        <planeGeometry args={[w * 0.6, 0.18]} />
      </mesh>
      <Monitor position={[0, 1.11, 0]} />
    </group>
  );
}

export function ConferenceTable({ w, d }: { w: number; d: number }) {
  const seats = 5;
  const gap = (w - 0.8) / (seats - 1);
  return (
    <group>
      <Box size={[w, 0.08, d]} position={[0, 0.74, 0]} material={mat.woodDark} />
      <Box size={[0.5, 0.7, 0.5]} position={[-w / 4, 0.36, 0]} material={mat.metal} />
      <Box size={[0.5, 0.7, 0.5]} position={[w / 4, 0.36, 0]} material={mat.metal} />
      {Array.from({ length: seats }, (_, i) => {
        const x = -w / 2 + 0.4 + i * gap;
        return (
          <group key={i}>
            <Chair position={[x, 0, -d / 2 - 0.45]} rotation={[0, Math.PI, 0]} />
            <Chair position={[x, 0, d / 2 + 0.45]} />
          </group>
        );
      })}
      <Chair position={[-w / 2 - 0.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
      <Chair position={[w / 2 + 0.5, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
    </group>
  );
}

export function Sofa({ w, d }: { w: number; d: number }) {
  return (
    <group>
      <Box size={[w, 0.4, d]} position={[0, 0.25, 0]} material={mat.fabricWarm} />
      <Box size={[w, 0.5, 0.2]} position={[0, 0.65, -d / 2 + 0.1]} material={mat.fabricWarm} />
      <Box size={[0.2, 0.3, d]} position={[-w / 2 + 0.1, 0.55, 0]} material={mat.fabricWarm} />
      <Box size={[0.2, 0.3, d]} position={[w / 2 - 0.1, 0.55, 0]} material={mat.fabricWarm} />
    </group>
  );
}

export function Plant() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]} material={mat.pot} castShadow receiveShadow>
        <cylinderGeometry args={[0.24, 0.18, 0.5, 14]} />
      </mesh>
      <mesh position={[0, 0.49, 0]} material={mat.soil}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 14]} />
      </mesh>
      <mesh position={[0, 0.95, 0]} material={mat.leaf} castShadow>
        <icosahedronGeometry args={[0.42, 1]} />
      </mesh>
      <mesh position={[0.15, 1.3, 0.05]} material={mat.leafLight} castShadow>
        <icosahedronGeometry args={[0.28, 1]} />
      </mesh>
    </group>
  );
}

/** Wall-mounted dashboard panel with a subtle holographic overlay. */
export function ScreenWall({ w }: { w: number; d: number }) {
  return (
    <group>
      <Box size={[w, 1.4, 0.08]} position={[0, 1.7, 0]} material={mat.metal} />
      <mesh position={[0, 1.7, 0.05]} material={mat.screenGlow}>
        <planeGeometry args={[w - 0.2, 1.2]} />
      </mesh>
      <mesh position={[0, 1.7, 0.4]} material={mat.holo}>
        <planeGeometry args={[w * 0.5, 0.7]} />
      </mesh>
    </group>
  );
}

export function FurnitureItem({ def }: { def: FurnitureDef }) {
  const { kind, x, z, rotY = 0, w, d } = def;
  // A staffed desk's monitor is lit only while its employee is actually engaged.
  const owner = SEED_EMPLOYEES.find((e) => e.workstationId === def.id);
  const screenOn = useEmployeeStore((s) => (owner ? screenIsOn(s.statuses[owner.id]) : false));
  return (
    <group position={[x, 0, z]} rotation={[0, rotY, 0]} userData={{ furnitureId: def.id }}>
      {kind === "desk" && <Desk w={w} d={d} screenOn={screenOn} />}
      {kind === "executiveDesk" && <ExecutiveDesk w={w} d={d} />}
      {kind === "receptionDesk" && <ReceptionDesk w={w} d={d} />}
      {kind === "conferenceTable" && <ConferenceTable w={w} d={d} />}
      {kind === "sofa" && <Sofa w={w} d={d} />}
      {kind === "plant" && <Plant />}
      {kind === "screenWall" && <ScreenWall w={w} d={d} />}
    </group>
  );
}
