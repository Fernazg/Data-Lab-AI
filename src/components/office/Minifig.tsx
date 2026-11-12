"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import type { Group } from "three";
import type { AgentProfile } from "@/lib/agents/roster";

export type Pose = "sit-idle" | "sit-typing" | "sit-thinking" | "sit-meeting" | "walk" | "stand-blocked" | "stand-celebrate";

const SKIN = "#facc15";

/**
 * Personaje estilo minifigura construido con primitivas (sin modelos externos).
 * Mira hacia +z. El origen está en el suelo, entre los pies.
 */
export function Minifig({ look, pose, phase = 0 }: { look: AgentProfile["look"]; pose: Pose; phase?: number }) {
  const body = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const head = useRef<Group>(null);

  const seated = pose.startsWith("sit");

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase;
    if (!body.current || !legL.current || !legR.current || !armL.current || !armR.current || !head.current || !hips.current) return;

    // Valores base
    let legSwing = 0;
    let armLx = 0;
    let armRx = 0;
    let headY = 0;
    let headX = 0;
    let bob = 0;

    switch (pose) {
      case "walk":
        legSwing = Math.sin(t * 9) * 0.6;
        armLx = -legSwing * 0.8;
        armRx = legSwing * 0.8;
        bob = Math.abs(Math.sin(t * 9)) * 0.05;
        break;
      case "sit-typing":
        armLx = -1.2 + Math.sin(t * 18) * 0.12;
        armRx = -1.2 + Math.sin(t * 18 + 1.7) * 0.12;
        headX = 0.12 + Math.sin(t * 2) * 0.03;
        break;
      case "sit-thinking":
        armLx = -1.0;
        armRx = -2.2 + Math.sin(t * 1.5) * 0.08; // mano al mentón
        headY = Math.sin(t * 0.9) * 0.5;
        headX = -0.1;
        break;
      case "sit-meeting":
        armLx = -0.9;
        armRx = -0.9 + Math.sin(t * 2.2) * 0.25;
        headX = Math.sin(t * 2.5) * 0.08;
        headY = Math.sin(t * 0.6) * 0.35;
        break;
      case "stand-blocked":
        armLx = -0.4;
        armRx = -2.6 + Math.sin(t * 4) * 0.15; // brazo levantado pidiendo atención
        headY = Math.sin(t * 1.4) * 0.25;
        break;
      case "stand-celebrate":
        armLx = -2.8 + Math.sin(t * 8) * 0.2;
        armRx = -2.8 + Math.sin(t * 8 + 1) * 0.2;
        bob = Math.max(0, Math.sin(t * 6)) * 0.25;
        break;
      default: // sit-idle
        armLx = -0.5;
        armRx = -0.5;
        bob = Math.sin(t * 1.6) * 0.01;
        headY = Math.sin(t * 0.4) * 0.2;
    }

    const lerp = (a: number, b: number) => a + (b - a) * 0.2;
    legL.current.rotation.x = seated ? -Math.PI / 2 : lerp(legL.current.rotation.x, legSwing);
    legR.current.rotation.x = seated ? -Math.PI / 2 : lerp(legR.current.rotation.x, -legSwing);
    armL.current.rotation.x = lerp(armL.current.rotation.x, armLx);
    armR.current.rotation.x = lerp(armR.current.rotation.x, armRx);
    head.current.rotation.y = lerp(head.current.rotation.y, headY);
    head.current.rotation.x = lerp(head.current.rotation.x, headX);
    body.current.position.y = (seated ? -0.1 : 0) + bob;
  });

  const hairPiece = useMemo(() => {
    if (look.hat === "cap")
      return (
        <group position={[0, 0.2, 0]}>
          <mesh castShadow position={[0, 0, 0]}>
            <cylinderGeometry args={[0.19, 0.19, 0.1, 20]} />
            <meshStandardMaterial color={look.accent} />
          </mesh>
          <mesh castShadow position={[0, -0.03, 0.17]}>
            <boxGeometry args={[0.3, 0.03, 0.16]} />
            <meshStandardMaterial color={look.accent} />
          </mesh>
        </group>
      );
    if (look.hat === "beanie")
      return (
        <mesh castShadow position={[0, 0.18, 0]}>
          <sphereGeometry args={[0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={look.accent} />
        </mesh>
      );
    return (
      <group>
        <mesh castShadow position={[0, 0.16, -0.01]}>
          <sphereGeometry args={[0.2, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />
          <meshStandardMaterial color={look.hair} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.02, -0.1]}>
          <boxGeometry args={[0.36, 0.26, 0.14]} />
          <meshStandardMaterial color={look.hair} roughness={0.8} />
        </mesh>
      </group>
    );
  }, [look]);

  return (
    <group ref={body}>
      {/* Piernas (pivotan en la cadera) */}
      <group ref={hips} position={[0, 0.5, 0]}>
        <mesh castShadow position={[0, 0.03, 0]}>
          <boxGeometry args={[0.42, 0.1, 0.24]} />
          <meshStandardMaterial color={look.legs} />
        </mesh>
        <group ref={legL} position={[-0.11, 0, 0]}>
          <mesh castShadow position={[0, -0.24, 0]}>
            <boxGeometry args={[0.19, 0.46, 0.22]} />
            <meshStandardMaterial color={look.legs} />
          </mesh>
          <mesh castShadow position={[0, -0.46, 0.04]}>
            <boxGeometry args={[0.19, 0.08, 0.3]} />
            <meshStandardMaterial color={look.legs} />
          </mesh>
        </group>
        <group ref={legR} position={[0.11, 0, 0]}>
          <mesh castShadow position={[0, -0.24, 0]}>
            <boxGeometry args={[0.19, 0.46, 0.22]} />
            <meshStandardMaterial color={look.legs} />
          </mesh>
          <mesh castShadow position={[0, -0.46, 0.04]}>
            <boxGeometry args={[0.19, 0.08, 0.3]} />
            <meshStandardMaterial color={look.legs} />
          </mesh>
        </group>
      </group>

      {/* Torso trapezoidal */}
      <mesh castShadow position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.2, 0.26, 0.5, 4, 1]} />
        <meshStandardMaterial color={look.torso} flatShading />
      </mesh>
      {/* Detalle del pecho */}
      <mesh position={[0, 0.85, 0.15]} rotation={[-0.1, 0, 0]}>
        <planeGeometry args={[0.12, 0.2]} />
        <meshStandardMaterial color={look.accent} />
      </mesh>

      {/* Brazos (pivotan en el hombro) */}
      {[
        { ref: armL, x: -0.27, z: 0.12 },
        { ref: armR, x: 0.27, z: -0.12 },
      ].map(({ ref, x, z }) => (
        <group key={x} ref={ref} position={[x, 0.98, 0]} rotation={[0, 0, z]}>
          <mesh castShadow position={[0, -0.18, 0]}>
            <cylinderGeometry args={[0.07, 0.08, 0.36, 10]} />
            <meshStandardMaterial color={look.torso} />
          </mesh>
          <mesh castShadow position={[0, -0.4, 0.02]}>
            <torusGeometry args={[0.05, 0.025, 6, 12, Math.PI * 1.5]} />
            <meshStandardMaterial color={SKIN} />
          </mesh>
        </group>
      ))}

      {/* Cuello + cabeza con pivote */}
      <mesh position={[0, 1.08, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.06, 12]} />
        <meshStandardMaterial color={SKIN} />
      </mesh>
      <group ref={head} position={[0, 1.24, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.17, 0.17, 0.27, 24]} />
          <meshStandardMaterial color={SKIN} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.07, 16]} />
          <meshStandardMaterial color={SKIN} roughness={0.4} />
        </mesh>
        {/* Cara */}
        <mesh position={[-0.06, 0.03, 0.165]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        <mesh position={[0.06, 0.03, 0.165]}>
          <sphereGeometry args={[0.022, 8, 8]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        <mesh position={[0, -0.05, 0.16]} rotation={[0, 0, Math.PI]}>
          <torusGeometry args={[0.055, 0.012, 6, 16, Math.PI]} />
          <meshBasicMaterial color="#111" />
        </mesh>
        {hairPiece}
      </group>
    </group>
  );
}
