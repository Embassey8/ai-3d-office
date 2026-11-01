"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import { attachKeyboard } from "@/lib/input";
import { useUiStore } from "@/store/ui";
import { Office } from "./Office";
import { Rig } from "./Rig";

function Lighting() {
  return (
    <>
      <hemisphereLight args={["#fff4e0", "#4b4036", 0.9]} />
      <ambientLight intensity={0.25} color="#ffe9cc" />
      <directionalLight
        position={[18, 30, 12]}
        intensity={2.1}
        color="#ffe3b8"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={90}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  );
}

export default function OfficeScene() {
  const mode = useUiStore((s) => s.cameraMode);
  const setSceneReady = useUiStore((s) => s.setSceneReady);

  useEffect(() => attachKeyboard(), []);

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
      onCreated={() => setSceneReady(true)}
    >
      <color attach="background" args={["#1b2230"]} />
      <fog attach="fog" args={["#1b2230", 60, 140]} />
      {mode === "isometric" ? (
        <OrthographicCamera makeDefault near={-200} far={300} zoom={20} />
      ) : (
        <PerspectiveCamera makeDefault fov={55} near={0.1} far={250} position={[-6, 4, 0.5]} />
      )}
      <Lighting />
      <Suspense fallback={null}>
        <Office />
        <Rig />
      </Suspense>
    </Canvas>
  );
}
