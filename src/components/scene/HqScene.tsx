"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { attachKeyboard } from "@/lib/input";
import { FLOOR_SIZE, ROOMS, agentsByRoom, roomForDepartment } from "@/lib/office/departments";
import { effectiveStatus, useEmployeeStore } from "@/store/employees";
import { useUiStore } from "@/store/ui";
import { CameraControls } from "./CameraControls";
import { Brain, Room, Roads } from "./parts";
import { FLOOR_CENTER, PX } from "./util";

function Lights() {
  return (
    <>
      <hemisphereLight args={["#DCE4FF", "#2A2F45", 1.15]} />
      <directionalLight
        position={[-30, 70, 45]} intensity={1.6} castShadow
        shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60}
        shadow-camera-near={1} shadow-camera-far={200} shadow-bias={-0.0004} shadow-normalBias={0.05}
      />
    </>
  );
}

function World() {
  const employees = useEmployeeStore((s) => s.employees);
  const previews = useEmployeeStore((s) => s.previews);
  const statuses = useEmployeeStore((s) => s.statuses);
  const selectedId = useEmployeeStore((s) => s.selectedId);
  const memoryCount = useEmployeeStore((s) => s.memoryCount);
  const select = useEmployeeStore((s) => s.select);
  const focusRoomKey = useUiStore((s) => s.focusRoomKey);
  const setActiveChat = useUiStore((s) => s.setActiveChat);

  const byRoom = useMemo(() => agentsByRoom(employees), [employees]);
  const statusOf = (id: string) => effectiveStatus({ statuses, previews }, id);

  return (
    <group scale={PX} position={[-FLOOR_CENTER, 0, -FLOOR_CENTER]}>
      <Roads />
      <Brain notes={memoryCount} />
      {ROOMS.map((room) => (
        <Room
          key={room.key} room={room} agents={byRoom[room.key]} statusOf={statusOf} selectedId={selectedId}
          onRoom={() => focusRoomKey(room.key)}
          onAgent={(id) => {
            select(id);
            setActiveChat(id);
            const e = employees.find((x) => x.id === id);
            if (e) focusRoomKey(roomForDepartment(e.department));
          }}
        />
      ))}
    </group>
  );
}

export default function HqScene() {
  const setSceneReady = useUiStore((s) => s.setSceneReady);
  useEffect(() => attachKeyboard(), []);
  void FLOOR_SIZE;
  return (
    <Canvas shadows="soft" dpr={[1, 1.75]} gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }} style={{ touchAction: "none" }} onCreated={() => setSceneReady(true)}>
      <Lights />
      <Suspense fallback={null}>
        <World />
        <CameraControls />
      </Suspense>
    </Canvas>
  );
}
