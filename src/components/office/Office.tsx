"use client";

import { memo } from "react";
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
      <Furnishings />
      {/* Ground plane around the building */}
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#2a3340" roughness={1} />
      </mesh>
    </group>
  );
}
