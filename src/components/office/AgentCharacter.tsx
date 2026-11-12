"use client";

import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import { Vector3, type Group } from "three";
import type { AgentProfile } from "@/lib/agents/roster";
import { STATUS_META } from "@/lib/client/labels";
import type { AgentStatus } from "@/lib/types";
import { Minifig, type Pose } from "./Minifig";

/** Pasillo central por el que caminan los personajes entre zonas. */
const CORRIDOR_Z = -0.6;
const SPEED = 3.2;
/** Puerta de la sala de reuniones (hueco en la pared de cristal). */
const DOOR_X = 11;
const DOOR_INSIDE_Z = -3;

function inMeetingRoom(v: { x: number; z: number }) {
  return v.x > 4 && v.z < -2;
}

/** Ruta por el pasillo central, entrando/saliendo de la sala por su puerta. */
export function planPath(from: Vector3, dest: Vector3): Vector3[] {
  if (from.distanceTo(dest) <= 2.5 && inMeetingRoom(from) === inMeetingRoom(dest)) return [dest];
  const pts: Vector3[] = [];
  if (inMeetingRoom(from)) pts.push(new Vector3(DOOR_X, 0, DOOR_INSIDE_Z), new Vector3(DOOR_X, 0, CORRIDOR_Z));
  else pts.push(new Vector3(from.x, 0, CORRIDOR_Z));
  if (inMeetingRoom(dest)) pts.push(new Vector3(DOOR_X, 0, CORRIDOR_Z), new Vector3(DOOR_X, 0, DOOR_INSIDE_Z));
  else pts.push(new Vector3(dest.x, 0, CORRIDOR_Z));
  pts.push(dest);
  return pts;
}

export interface Spot {
  x: number;
  z: number;
  rot: number;
  seated: boolean;
}

export function targetSpot(profile: AgentProfile, status: AgentStatus, meetingSeat?: [number, number, number]): Spot {
  const [dx, dz] = profile.desk;
  if (status === "reunido" && meetingSeat) return { x: meetingSeat[0], z: meetingSeat[1], rot: meetingSeat[2], seated: true };
  if (status === "bloqueado" || status === "finalizado") return { x: dx + 1.15, z: dz - 0.6, rot: -0.5, seated: false };
  return { x: dx, z: dz - 0.95, rot: 0, seated: true };
}

function poseFor(status: AgentStatus): Pose {
  switch (status) {
    case "trabajando":
      return "sit-typing";
    case "investigando":
      return "sit-thinking";
    case "reunido":
      return "sit-meeting";
    case "bloqueado":
      return "stand-blocked";
    case "finalizado":
      return "stand-celebrate";
    default:
      return "sit-idle";
  }
}

export function AgentCharacter({
  profile,
  status,
  meetingSeat,
  selected,
  onSelect,
  index,
}: {
  profile: AgentProfile;
  status: AgentStatus;
  meetingSeat?: [number, number, number];
  selected: boolean;
  onSelect: () => void;
  index: number;
}) {
  const root = useRef<Group>(null);
  const target = useMemo(() => targetSpot(profile, status, meetingSeat), [profile, status, meetingSeat]);
  const start = useMemo(() => targetSpot(profile, "disponible"), [profile]);
  const pos = useRef(new Vector3(start.x, 0, start.z));
  const path = useRef<Vector3[]>([]);
  const lastTarget = useRef<Spot>(start);
  const [walking, setWalking] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Recalcula la ruta (vía pasillo) cuando cambia el destino.
  useEffect(() => {
    if (lastTarget.current === target) return;
    lastTarget.current = target;
    path.current = planPath(pos.current.clone(), new Vector3(target.x, 0, target.z));
  }, [target]);

  useFrame((_, delta) => {
    const g = root.current;
    if (!g) return;
    const next = path.current[0];
    if (next) {
      const dir = next.clone().sub(pos.current);
      const dist = dir.length();
      const step = Math.min(dist, SPEED * Math.min(delta, 0.05));
      if (dist < 0.02) {
        path.current.shift();
        if (path.current.length === 0) setWalking(false);
      } else {
        if (!walking) setWalking(true);
        dir.normalize();
        pos.current.addScaledVector(dir, step);
        g.rotation.y = lerpAngle(g.rotation.y, Math.atan2(dir.x, dir.z), 0.25);
      }
    } else {
      g.rotation.y = lerpAngle(g.rotation.y, target.rot, 0.15);
    }
    g.position.copy(pos.current);
  });

  const meta = STATUS_META[status];
  const pose: Pose = walking ? "walk" : poseFor(status);
  const showDetail = selected || hovered;

  return (
    <group
      ref={root}
      position={[start.x, 0, start.z]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "";
      }}
    >
      {/* Anillo de estado en el suelo */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.36, selected ? 0.5 : 0.44, 32]} />
        <meshBasicMaterial color={selected ? "#0f172a" : meta.color} transparent opacity={selected ? 0.9 : 0.75} />
      </mesh>
      <Minifig look={profile.look} pose={pose} phase={index * 1.37} />
      <Html position={[0, 2.05, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
        <div className="flex flex-col items-center gap-0.5 select-none">
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ring-2 ring-white"
            style={{ background: meta.color }}
            title={meta.label}
          >
            {meta.symbol}
          </div>
          {showDetail ? (
            <div className="whitespace-nowrap rounded-md bg-white/95 px-2 py-0.5 text-center shadow ring-1 ring-black/5">
              <div className="text-[11px] font-semibold leading-tight text-zinc-900">{profile.name}</div>
              <div className="text-[9px] leading-tight text-zinc-500">
                {profile.role} · <span style={{ color: meta.color }}>{meta.label}</span>
              </div>
            </div>
          ) : (
            <div className="whitespace-nowrap rounded bg-white/80 px-1 text-[9px] font-semibold leading-tight text-zinc-700 shadow-sm">{profile.name.split(" ")[0]}</div>
          )}
        </div>
      </Html>
    </group>
  );
}

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
