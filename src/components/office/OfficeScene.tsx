"use client";

import { Html, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { AGENTS, DEPARTMENTS, MEETING_ROOM } from "@/lib/agents/roster";
import type { AgentId, AgentRuntime } from "@/lib/types";
import { AgentCharacter } from "./AgentCharacter";
import { Baseplate, Bookshelf, Chair, CoffeeCorner, Desk, Plant, ServerRack, Whiteboard } from "./Furniture";

const FLOOR_W = 28;
const FLOOR_D = 20;

function Zone({ center, size, color, name }: { center: [number, number]; size: [number, number]; color: string; name: string }) {
  return (
    <group position={[center[0], 0, center[1]]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]} receiveShadow>
        <planeGeometry args={size} />
        <meshStandardMaterial color={color} />
      </mesh>
      <Html position={[-size[0] / 2 + 0.6, 0.1, size[1] / 2 - 0.4]} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-white/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-600 shadow-sm">{name}</div>
      </Html>
    </group>
  );
}

function Walls() {
  const wall = "#e7e5e4";
  return (
    <group>
      {/* Pared del fondo con ventanas */}
      <mesh castShadow receiveShadow position={[0, 1.4, -FLOOR_D / 2 + 0.15]}>
        <boxGeometry args={[FLOOR_W, 2.8, 0.3]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      {[-10, -4, 2, 8].map((x) => (
        <mesh key={x} position={[x, 1.7, -FLOOR_D / 2 + 0.31]}>
          <planeGeometry args={[3, 1.2]} />
          <meshStandardMaterial color="#bae6fd" emissive="#7dd3fc" emissiveIntensity={0.25} />
        </mesh>
      ))}
      {/* Pared izquierda */}
      <mesh castShadow receiveShadow position={[-FLOOR_W / 2 + 0.15, 1.4, 0]}>
        <boxGeometry args={[0.3, 2.8, FLOOR_D]} />
        <meshStandardMaterial color={wall} />
      </mesh>
      {/* Logo */}
      <Html position={[0, 2.5, -FLOOR_D / 2 + 0.32]} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="rounded-lg bg-zinc-900 px-4 py-1 text-lg font-black tracking-widest text-white">
          DATA LAB <span className="text-amber-400">AI</span>
        </div>
      </Html>
    </group>
  );
}

function GlassWall({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0];
  const dz = to[1] - from[1];
  const len = Math.hypot(dx, dz);
  return (
    <group position={[(from[0] + to[0]) / 2, 0, (from[1] + to[1]) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[len, 1.8, 0.05]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.25} />
      </mesh>
      <mesh position={[0, 1.82, 0]}>
        <boxGeometry args={[len, 0.06, 0.08]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
    </group>
  );
}

function MeetingRoom({ busy }: { busy: number }) {
  const [cx, cz] = MEETING_ROOM.center;
  const [w, d] = MEETING_ROOM.size;
  return (
    <group>
      <Zone center={MEETING_ROOM.center} size={MEETING_ROOM.size} color="#fef3c7" name={MEETING_ROOM.name} />
      {/* Mesa */}
      <mesh castShadow receiveShadow position={[cx, 0.7, cz]}>
        <boxGeometry args={[5, 0.1, 1.6]} />
        <meshStandardMaterial color="#78350f" />
      </mesh>
      {[-2, 2].map((s) => (
        <mesh key={s} castShadow position={[cx + s, 0.35, cz]}>
          <boxGeometry args={[0.15, 0.7, 1.2]} />
          <meshStandardMaterial color="#451a03" />
        </mesh>
      ))}
      {MEETING_ROOM.seats.map(([x, z, r], i) => (
        <Chair key={i} position={[x, 0, z]} rotation={r} color={i === 0 ? "#111827" : "#92400e"} />
      ))}
      <Whiteboard position={[cx, 1.5, cz - d / 2 + 0.35]} lines={busy} />
      <GlassWall from={[cx - w / 2, cz + d / 2]} to={[cx + w / 2 - 2, cz + d / 2]} />
      <GlassWall from={[cx - w / 2, cz - d / 2 + 0.3]} to={[cx - w / 2, cz + d / 2]} />
    </group>
  );
}

export function OfficeScene({
  agents,
  selected,
  onSelect,
}: {
  agents: AgentRuntime[];
  selected: AgentId | null;
  onSelect: (id: AgentId | null) => void;
}) {
  const runtime = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  // Asientos de la sala de reuniones: el CEO en la cabecera, el resto por orden del equipo.
  const seats = useMemo(() => {
    const map = new Map<AgentId, [number, number, number]>();
    let next = 1;
    for (const a of AGENTS) {
      if (runtime.get(a.id)?.status !== "reunido") continue;
      map.set(a.id, a.id === "ceo" ? MEETING_ROOM.seats[0] : MEETING_ROOM.seats[Math.min(next++, MEETING_ROOM.seats.length - 1)]);
    }
    return map;
  }, [runtime]);

  return (
    <Canvas shadows dpr={[1, 2]} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
      <color attach="background" args={["#e0f2fe"]} />
      <OrthographicCamera makeDefault position={[22, 20, 22]} zoom={34} near={-100} far={200} />
      <OrbitControls
        target={[0, 0, -0.5]}
        enableRotate
        minPolarAngle={0.5}
        maxPolarAngle={1.1}
        minZoom={18}
        maxZoom={90}
        enableDamping
        screenSpacePanning
      />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.9]} />
      <directionalLight
        castShadow
        position={[12, 22, 10]}
        intensity={1.6}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0005}
      />

      <Suspense fallback={null}>
        <Baseplate width={FLOOR_W} depth={FLOOR_D} color="#d6d3d1" />
        <Walls />
        {DEPARTMENTS.map((d) => (
          <Zone key={d.id} center={d.center} size={d.size} color={d.color} name={d.name} />
        ))}
        <MeetingRoom busy={seats.size} />

        {/* Puestos de trabajo */}
        {AGENTS.map((a) => (
          <group key={a.id}>
            <Desk position={a.desk} accent={a.look.torso} status={runtime.get(a.id)?.status ?? "disponible"} wide={a.id === "ceo"} />
            <Chair position={[a.desk[0], 0, a.desk[1] - 0.95]} color={a.id === "ceo" ? "#111827" : "#475569"} />
          </group>
        ))}

        {/* Decoración */}
        <ServerRack position={[-12.9 + 0.6, -1.5]} />
        <ServerRack position={[-12.9 + 0.6, -0.4]} />
        <Bookshelf position={[-10.8, -8.6]} />
        <Bookshelf position={[-2.5, -8.6]} />
        <CoffeeCorner position={[12.6, 0.6]} />
        <Plant position={[-12.3, -8.4]} />
        <Plant position={[12.6, 8.6]} scale={1.2} />
        <Plant position={[-12.3, 8.5]} />
        <Plant position={[4, -8.4]} />
        <Plant position={[12.8, 7.2]} />

        {AGENTS.map((a, i) => (
          <AgentCharacter
            key={a.id}
            index={i}
            profile={a}
            status={runtime.get(a.id)?.status ?? "disponible"}
            meetingSeat={seats.get(a.id)}
            selected={selected === a.id}
            onSelect={() => onSelect(a.id)}
          />
        ))}
      </Suspense>
    </Canvas>
  );
}
