import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import { laneProgress, laneRadii, ovalPoint, ovalTangent } from './trackMath'

type Props = {
  horse: HorseData
  lane: number
  lanes: number
  /** Shared race clock 0–1 looping */
  getProgress: () => number
}

export function HorseMesh({ horse, lane, lanes, getProgress }: Props) {
  const group = useRef<THREE.Group>(null)
  const legPhase = useRef(Math.random() * Math.PI * 2)
  const { rx, rz } = useMemo(() => laneRadii(lane, lanes), [lane, lanes])

  useFrame((_, dt) => {
    if (!group.current) return
    const p = laneProgress(getProgress() * horse.speedBias, lane, lanes)
    const pos = ovalPoint(p, rx, rz)
    const tan = ovalTangent(p, rx, rz)
    group.current.position.set(pos.x, 0.35, pos.z)
    const yaw = Math.atan2(tan.x, tan.z)
    group.current.rotation.y = yaw

    // Simple gallop bob
    legPhase.current += dt * 14
    group.current.position.y = 0.35 + Math.sin(legPhase.current) * 0.06
  })

  return (
    <group ref={group}>
      {/* Body */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <capsuleGeometry args={[0.28, 0.7, 4, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.75} />
      </mesh>
      {/* Jersey / saddle cloth */}
      <mesh castShadow position={[0, 0.48, 0.05]}>
        <boxGeometry args={[0.45, 0.12, 0.5]} />
        <meshStandardMaterial color={horse.jersey} roughness={0.55} metalness={0.1} />
      </mesh>
      {/* Neck + head */}
      <mesh castShadow position={[0, 0.55, 0.55]} rotation={[0.4, 0, 0]}>
        <capsuleGeometry args={[0.12, 0.35, 4, 6]} />
        <meshStandardMaterial color="#4a3226" roughness={0.8} />
      </mesh>
      <mesh castShadow position={[0, 0.72, 0.85]}>
        <boxGeometry args={[0.22, 0.18, 0.28]} />
        <meshStandardMaterial color="#3d291e" />
      </mesh>
      {/* Legs (static stilts) */}
      {[
        [-0.15, -0.15],
        [0.15, -0.15],
        [-0.15, 0.25],
        [0.15, 0.25],
      ].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, -0.05, z]}>
          <boxGeometry args={[0.07, 0.45, 0.07]} />
          <meshStandardMaterial color="#2e2218" />
        </mesh>
      ))}
      {/* Number billboard */}
      <Billboard position={[0, 1.35, 0]} follow>
        <Text
          fontSize={0.35}
          color="#f0e6d2"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.03}
          outlineColor="#0c0907"
        >
          {String(horse.number)}
        </Text>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.55, 0.45]} />
          <meshBasicMaterial color={horse.jersey} transparent opacity={0.9} />
        </mesh>
      </Billboard>
    </group>
  )
}
