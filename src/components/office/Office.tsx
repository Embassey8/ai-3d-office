"use client";

import { memo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { DOORS, doorOpen } from "@/lib/office/doors";
import {
  CORRIDOR,
  DOOR_WIDTH,
  FURNITURE,
  OFFICE_BOUNDS,
  ROOMS,
  WALLS,
  WALL_HEIGHT,
  WALL_THICKNESS,
  doorCentreX,
  type FloorMaterial,
} from "@/lib/office/layout";
import { useUiStore } from "@/store/ui";
import { mat } from "./materials";
import { FurnitureItem } from "./furniture/Furniture";

const floorMaterial: Record<FloorMaterial, import("three").Material> = {
  wood: mat.woodFloor,
  stone: mat.stoneFloor,
  carpet: mat.carpetFloor,
};

const Floors = memo(function Floors() {
  const { minX, maxX } = OFFICE_BOUNDS;
  return (
    <group>
      {ROOMS.map((r) => (
        <mesh
          key={r.id}
          position={[r.x + r.w / 2, 0, r.z + r.d / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={floorMaterial[r.floor]}
          receiveShadow
        >
          <planeGeometry args={[r.w, r.d]} />
        </mesh>
      ))}
      <mesh
        position={[(minX + maxX) / 2, 0, (CORRIDOR.minZ + CORRIDOR.maxZ) / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={mat.corridorFloor}
        receiveShadow
      >
        <planeGeometry args={[maxX - minX, CORRIDOR.maxZ - CORRIDOR.minZ]} />
      </mesh>
    </group>
  );
});

/**
 * Walls are unit-height boxes scaled on Y. In isometric mode the same walls
 * drop to a low "cutaway" height so the whole office stays visible.
 */
function Walls() {
  const mode = useUiStore((s) => s.cameraMode);
  const iso = mode === "isometric";
  const height = iso ? 1.0 : WALL_HEIGHT;
  return (
    <group scale={[1, height, 1]}>
      {WALLS.map((w, i) => (
        <mesh
          key={i}
          position={[w.cx, 0.5, w.cz]}
          material={w.kind === "glass" ? mat.glass : mat.wall}
          castShadow={w.kind === "solid"}
          receiveShadow
        >
          <boxGeometry args={[w.hw * 2, 1, w.hd * 2]} />
        </mesh>
      ))}
    </group>
  );
}

/** Lintels above doorways give each room a visible entrance. Hidden in cutaway view. */
function DoorHeaders() {
  const iso = useUiStore((s) => s.cameraMode === "isometric");
  if (iso) return null;
  const headerH = WALL_HEIGHT - 2.4;
  return (
    <group>
      {ROOMS.map((r) => {
        const z = r.doorSide === "south" ? CORRIDOR.minZ : CORRIDOR.maxZ;
        return (
          <group key={r.id}>
            <mesh
              position={[doorCentreX(r), 2.4 + headerH / 2, z]}
              material={mat.wall}
              castShadow
            >
              <boxGeometry args={[DOOR_WIDTH, headerH, WALL_THICKNESS]} />
            </mesh>
            <mesh position={[doorCentreX(r), 2.35, z]} material={mat.accent}>
              <boxGeometry args={[DOOR_WIDTH, 0.05, WALL_THICKNESS + 0.04]} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

/** Sliding glass doors; open fraction is driven by proximity (see lib/office/doors.ts). */
function Doors() {
  const iso = useUiStore((s) => s.cameraMode === "isometric");
  const refs = useRef<Record<string, { l: Group | null; r: Group | null }>>({});
  const half = DOOR_WIDTH / 2;
  useFrame(() => {
    for (const d of DOORS) {
      const o = doorOpen[d.roomId];
      const pair = refs.current[d.roomId];
      if (!pair) continue;
      if (pair.l) pair.l.position.x = d.x - half / 2 - o * half;
      if (pair.r) pair.r.position.x = d.x + half / 2 + o * half;
    }
  });
  return (
    <group scale={[1, iso ? 1 / 2.4 : 1, 1]}>
      {DOORS.map((d) => (
        <group key={d.roomId}>
          {(["l", "r"] as const).map((side) => (
            <group
              key={side}
              ref={(g) => {
                (refs.current[d.roomId] ??= { l: null, r: null })[side] = g;
              }}
              position={[d.x + (side === "l" ? -half / 2 : half / 2), 1.2, d.z]}
            >
              <mesh material={mat.glass}>
                <boxGeometry args={[half, 2.4, 0.05]} />
              </mesh>
              <mesh position={[0, 0, 0]} material={mat.metal}>
                <boxGeometry args={[half, 0.05, 0.07]} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

const Furnishings = memo(function Furnishings() {
  return (
    <group>
      {FURNITURE.map((f) => (
        <FurnitureItem key={f.id} def={f} />
      ))}
    </group>
  );
});

export function Office() {
  return (
    <group>
      <Floors />
      <Walls />
      <DoorHeaders />
      <Doors />
      <Furnishings />
      {/* Ground plane around the building */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#2a3340" roughness={1} />
      </mesh>
    </group>
  );
}
