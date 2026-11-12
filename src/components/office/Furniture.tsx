"use client";

import { RoundedBox } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedMesh, Object3D, type MeshStandardMaterial } from "three";
import type { AgentStatus } from "@/lib/types";

/** Silla de oficina. El asiento queda a ~0.38 de altura. */
export function Chair({ color = "#334155", position, rotation = 0 }: { color?: string; position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow position={[0, 0.34, 0]}>
        <boxGeometry args={[0.55, 0.08, 0.5]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh castShadow position={[0, 0.68, -0.26]}>
        <boxGeometry args={[0.55, 0.6, 0.08]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 8]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.04, 5]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
    </group>
  );
}

const SCREEN_COLOR: Record<AgentStatus, string> = {
  disponible: "#1e293b",
  trabajando: "#1d4ed8",
  investigando: "#7e22ce",
  reunido: "#1e293b",
  bloqueado: "#b91c1c",
  finalizado: "#0f766e",
};

/** Escritorio con monitor, teclado y taza. El monitor refleja el estado real del agente. */
export function Desk({ position, accent, status, wide = false }: { position: [number, number]; accent: string; status: AgentStatus; wide?: boolean }) {
  const screen = useRef<MeshStandardMaterial>(null);
  const lines = useRef<InstancedMesh>(null);
  const active = status === "trabajando" || status === "investigando";
  const w = wide ? 2.2 : 1.6;

  const dummy = useMemo(() => new Object3D(), []);
  const base = useMemo(() => new Color(SCREEN_COLOR[status]), [status]);
  useFrame(({ clock }) => {
    if (screen.current) {
      const pulse = active ? 0.6 + Math.sin(clock.elapsedTime * 6) * 0.15 : status === "bloqueado" ? 0.5 + Math.sin(clock.elapsedTime * 4) * 0.4 : 0.15;
      screen.current.emissive = base;
      screen.current.emissiveIntensity = pulse;
    }
    if (lines.current) {
      // "Líneas de código" que se desplazan en la pantalla cuando el agente trabaja.
      for (let i = 0; i < 5; i++) {
        const len = active ? 0.12 + ((Math.sin(clock.elapsedTime * 3 + i * 1.7) + 1) / 2) * 0.28 : 0.001;
        dummy.position.set(-0.22 + len / 2, 0.14 - i * 0.065, 0.001);
        dummy.scale.set(len, 1, 1);
        dummy.updateMatrix();
        lines.current.setMatrixAt(i, dummy.matrix);
      }
      lines.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group position={[position[0], 0, position[1]]}>
      {/* Tablero y patas */}
      <RoundedBox args={[w, 0.08, 0.9]} radius={0.03} position={[0, 0.72, 0]} castShadow receiveShadow>
        <meshStandardMaterial color="#f8fafc" />
      </RoundedBox>
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[s * (w / 2 - 0.08), 0.36, 0]}>
          <boxGeometry args={[0.08, 0.72, 0.8]} />
          <meshStandardMaterial color={accent} />
        </mesh>
      ))}
      {/* Monitor: desplazado a un lado para no tapar la cara; pantalla hacia el agente (-z) */}
      <group position={[-0.42, 0.76, 0.05]} rotation={[0, Math.PI + 0.35, 0]}>
        <mesh castShadow position={[0, 0.34, 0]}>
          <boxGeometry args={[0.62, 0.42, 0.05]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
        <mesh position={[0, 0.34, 0.027]}>
          <planeGeometry args={[0.56, 0.36]} />
          <meshStandardMaterial ref={screen} color="#0b1220" emissive={SCREEN_COLOR[status]} />
        </mesh>
        <instancedMesh ref={lines} args={[undefined, undefined, 5]} position={[0, 0.34, 0.03]}>
          <planeGeometry args={[1, 0.03]} />
          <meshBasicMaterial color="#e2e8f0" />
        </instancedMesh>
        <mesh position={[0, 0.07, 0]}>
          <boxGeometry args={[0.06, 0.14, 0.06]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.25, 0.02, 0.18]} />
          <meshStandardMaterial color="#334155" />
        </mesh>
      </group>
      {/* Teclado y taza */}
      <mesh position={[0.1, 0.77, -0.22]}>
        <boxGeometry args={[0.5, 0.025, 0.16]} />
        <meshStandardMaterial color="#cbd5e1" />
      </mesh>
      <mesh castShadow position={[w / 2 - 0.25, 0.82, 0.15]}>
        <cylinderGeometry args={[0.06, 0.05, 0.12, 12]} />
        <meshStandardMaterial color={accent} />
      </mesh>
    </group>
  );
}

export function Plant({ position, scale = 1 }: { position: [number, number]; scale?: number }) {
  return (
    <group position={[position[0], 0, position[1]]} scale={scale}>
      <mesh castShadow position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.22, 0.18, 0.5, 12]} />
        <meshStandardMaterial color="#a16207" />
      </mesh>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} castShadow position={[Math.cos(i * 1.3) * 0.12, 0.65 + i * 0.12, Math.sin(i * 1.3) * 0.12]}>
          <sphereGeometry args={[0.22 - i * 0.025, 10, 8]} />
          <meshStandardMaterial color={i % 2 ? "#16a34a" : "#22c55e"} flatShading />
        </mesh>
      ))}
    </group>
  );
}

/** Rack de servidores con luces parpadeantes (decorativo). */
export function ServerRack({ position }: { position: [number, number] }) {
  const leds = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const colors = useMemo(() => ["#22c55e", "#3b82f6", "#eab308"].map((c) => new Color(c)), []);
  useFrame(({ clock }) => {
    if (!leds.current) return;
    for (let i = 0; i < 12; i++) {
      const on = Math.sin(clock.elapsedTime * (2 + (i % 5)) + i) > 0;
      dummy.position.set(-0.2 + (i % 3) * 0.2, 0.35 + Math.floor(i / 3) * 0.4, 0.31);
      dummy.scale.setScalar(on ? 1 : 0.001);
      dummy.updateMatrix();
      leds.current.setMatrixAt(i, dummy.matrix);
      leds.current.setColorAt(i, colors[i % 3]);
    }
    leds.current.instanceMatrix.needsUpdate = true;
    if (leds.current.instanceColor) leds.current.instanceColor.needsUpdate = true;
  });
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh castShadow receiveShadow position={[0, 0.9, 0]}>
        <boxGeometry args={[0.8, 1.8, 0.6]} />
        <meshStandardMaterial color="#1e293b" />
      </mesh>
      <instancedMesh ref={leds} args={[undefined, undefined, 12]}>
        <boxGeometry args={[0.08, 0.04, 0.02]} />
        <meshBasicMaterial />
      </instancedMesh>
    </group>
  );
}

export function Bookshelf({ position, rotation = 0 }: { position: [number, number]; rotation?: number }) {
  const books = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
  return (
    <group position={[position[0], 0, position[1]]} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.8, 0]}>
        <boxGeometry args={[1.4, 1.6, 0.4]} />
        <meshStandardMaterial color="#92400e" />
      </mesh>
      {[0.35, 0.85, 1.35].map((y) =>
        books.map((c, i) => (
          <mesh key={`${y}-${i}`} position={[-0.5 + i * 0.2, y, 0.12]}>
            <boxGeometry args={[0.14, 0.32, 0.22]} />
            <meshStandardMaterial color={c} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function Whiteboard({ position, rotation = 0, lines = 0 }: { position: [number, number, number]; rotation?: number; lines?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow>
        <boxGeometry args={[2.4, 1.2, 0.06]} />
        <meshStandardMaterial color="#f8fafc" />
      </mesh>
      {Array.from({ length: Math.min(lines, 6) }).map((_, i) => (
        <mesh key={i} position={[-0.9 + ((i * 37) % 30) / 100, 0.4 - i * 0.15, 0.035]}>
          <planeGeometry args={[0.9 + ((i * 53) % 60) / 100, 0.04]} />
          <meshBasicMaterial color={["#2563eb", "#dc2626", "#16a34a"][i % 3]} />
        </mesh>
      ))}
    </group>
  );
}

/** Máquina de café y mesa auxiliar. */
export function CoffeeCorner({ position }: { position: [number, number] }) {
  return (
    <group position={[position[0], 0, position[1]]}>
      <mesh castShadow receiveShadow position={[0, 0.45, 0]}>
        <boxGeometry args={[1.2, 0.9, 0.6]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>
      <mesh castShadow position={[-0.25, 1.15, 0]}>
        <boxGeometry args={[0.45, 0.5, 0.4]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[-0.25, 1.2, 0.205]}>
        <planeGeometry args={[0.2, 0.08]} />
        <meshBasicMaterial color="#22d3ee" />
      </mesh>
      <mesh castShadow position={[0.3, 0.97, 0]}>
        <cylinderGeometry args={[0.06, 0.05, 0.13, 10]} />
        <meshStandardMaterial color="#f97316" />
      </mesh>
    </group>
  );
}

/** Placa base con "studs" estilo bloques de construcción (InstancedMesh: un solo draw call). */
export function Baseplate({ width, depth, color }: { width: number; depth: number; color: string }) {
  const studs = useRef<InstancedMesh>(null);
  const count = width * depth;
  useLayoutEffect(() => {
    if (!studs.current) return;
    const d = new Object3D();
    let i = 0;
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        d.position.set(-width / 2 + 0.5 + x, 0.02, -depth / 2 + 0.5 + z);
        d.updateMatrix();
        studs.current.setMatrixAt(i++, d.matrix);
      }
    }
    studs.current.instanceMatrix.needsUpdate = true;
  }, [width, depth]);
  return (
    <group>
      <mesh receiveShadow position={[0, -0.15, 0]}>
        <boxGeometry args={[width, 0.3, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <instancedMesh ref={studs} args={[undefined, undefined, count]} receiveShadow>
        <cylinderGeometry args={[0.15, 0.15, 0.06, 12]} />
        <meshStandardMaterial color={color} />
      </instancedMesh>
    </group>
  );
}
