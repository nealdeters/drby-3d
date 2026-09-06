import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from './trackMath'
import { trackPoint, trackTangent } from './trackMath'

type Props = {
  horse: HorseData
  index: number
  /** Shared mutable field state — read by index each frame */
  fieldRef: MutableRefObject<HorseSimState[]>
}

type LegRefs = {
  hip: THREE.Group
  knee: THREE.Group
}

/**
 * Low-poly thoroughbred with a readable gallop:
 * hind/fore phase offsets, knee bend, body/neck bob scaled by pace.
 */
export function HorseMesh({ horse, index, fieldRef }: Props) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const neck = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const jockey = useRef<THREE.Group>(null)

  const fl = useRef<LegRefs | null>(null)
  const fr = useRef<LegRefs | null>(null)
  const hl = useRef<LegRefs | null>(null)
  const hr = useRef<LegRefs | null>(null)

  const gait = useRef(Math.random() * Math.PI * 2)

  const coat = horse.coat
  const coatDark = useMemo(() => darken(coat, 0.22), [coat])
  const coatLight = useMemo(() => lighten(coat, 0.12), [coat])
  const sock = '#f2eee6'
  const hoof = '#1a1410'
  const mane = coatDark

  useFrame((_, dt) => {
    if (!root.current) return
    const s = fieldRef.current[index]
    if (!s) return

    const pos = trackPoint(s.progress, s.radial)
    const tan = trackTangent(s.progress, s.radial)

    // Gallop frequency scales with race pace (not just sliding along the rail)
    const strideHz = 2.4 + s.pace * 2.2
    gait.current += dt * strideHz * Math.PI * 2
    const g = gait.current

    // Transverse gallop phasing (approx left lead):
    // hind left → hind right → fore left → fore right
    const hlA = Math.sin(g)
    const hrA = Math.sin(g + 0.55)
    const flA = Math.sin(g + Math.PI + 0.25)
    const frA = Math.sin(g + Math.PI + 0.85)

    applyLeg(hl.current, hlA, true)
    applyLeg(hr.current, hrA, true)
    applyLeg(fl.current, flA, false)
    applyLeg(fr.current, frA, false)

    // Suspension / gather bob — two peaks per stride cycle feel horse-like
    const bob = Math.sin(g * 2) * 0.055
    const gather = Math.max(0, -Math.sin(g * 2)) * 0.03

    root.current.position.set(pos.x, 0.02 + bob, pos.z)
    root.current.rotation.y = Math.atan2(tan.x, tan.z)
    // Slight roll into the stride
    root.current.rotation.z = Math.sin(g) * 0.03
    root.current.rotation.x = Math.sin(g * 2) * 0.025

    if (body.current) {
      body.current.position.y = gather
      body.current.rotation.x = Math.sin(g * 2) * 0.04
    }
    if (neck.current) {
      neck.current.rotation.x = 0.35 + Math.sin(g * 2 + 0.4) * 0.12
    }
    if (head.current) {
      head.current.rotation.x = -0.15 + Math.sin(g * 2 + 0.8) * 0.08
    }
    if (tail.current) {
      tail.current.rotation.x = 0.35 + Math.sin(g * 2 + 1.2) * 0.25
      tail.current.rotation.y = Math.sin(g * 1.5) * 0.15
    }
    if (jockey.current) {
      jockey.current.position.y = 0.92 + bob * 0.35
      jockey.current.rotation.x = 0.35 + Math.sin(g * 2) * 0.04
    }
  })

  return (
    <group ref={root}>
      <group ref={body}>
        {/* Barrel / torso */}
        <mesh castShadow position={[0, 0.72, 0.02]} scale={[1, 1, 1.05]}>
          <boxGeometry args={[0.42, 0.48, 0.95]} />
          <meshStandardMaterial color={coat} roughness={0.82} />
        </mesh>
        {/* Chest */}
        <mesh castShadow position={[0, 0.7, 0.52]}>
          <boxGeometry args={[0.4, 0.46, 0.28]} />
          <meshStandardMaterial color={coatLight} roughness={0.8} />
        </mesh>
        {/* Rump */}
        <mesh castShadow position={[0, 0.74, -0.48]}>
          <boxGeometry args={[0.4, 0.42, 0.32]} />
          <meshStandardMaterial color={coat} roughness={0.82} />
        </mesh>
        {/* Belly tuck */}
        <mesh castShadow position={[0, 0.48, 0]}>
          <boxGeometry args={[0.34, 0.16, 0.7]} />
          <meshStandardMaterial color={coatDark} roughness={0.85} />
        </mesh>

        {/* Saddle + cloth (silks) */}
        <mesh castShadow position={[0, 0.98, -0.05]}>
          <boxGeometry args={[0.36, 0.06, 0.38]} />
          <meshStandardMaterial color="#2a2118" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 0.95, -0.02]}>
          <boxGeometry args={[0.5, 0.04, 0.42]} />
          <meshStandardMaterial color={horse.jersey} roughness={0.55} metalness={0.08} />
        </mesh>

        {/* Neck */}
        <group ref={neck} position={[0, 0.88, 0.58]}>
          <mesh castShadow position={[0, 0.22, 0.18]} rotation={[0.15, 0, 0]}>
            <boxGeometry args={[0.2, 0.28, 0.48]} />
            <meshStandardMaterial color={coat} roughness={0.8} />
          </mesh>
          {/* Mane */}
          <mesh castShadow position={[0, 0.38, 0.12]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.08, 0.14, 0.42]} />
            <meshStandardMaterial color={mane} roughness={0.9} />
          </mesh>

          {/* Head */}
          <group ref={head} position={[0, 0.38, 0.42]}>
            <mesh castShadow position={[0, 0.02, 0.12]}>
              <boxGeometry args={[0.22, 0.2, 0.32]} />
              <meshStandardMaterial color={coatDark} roughness={0.78} />
            </mesh>
            {/* Muzzle */}
            <mesh castShadow position={[0, -0.02, 0.34]}>
              <boxGeometry args={[0.16, 0.14, 0.2]} />
              <meshStandardMaterial color={coatLight} roughness={0.75} />
            </mesh>
            <mesh castShadow position={[0, -0.04, 0.44]}>
              <boxGeometry args={[0.14, 0.08, 0.06]} />
              <meshStandardMaterial color="#1c1612" roughness={0.6} />
            </mesh>
            {/* Ears */}
            <mesh castShadow position={[-0.07, 0.16, 0.02]} rotation={[0.25, 0, -0.2]}>
              <boxGeometry args={[0.05, 0.12, 0.04]} />
              <meshStandardMaterial color={coatDark} />
            </mesh>
            <mesh castShadow position={[0.07, 0.16, 0.02]} rotation={[0.25, 0, 0.2]}>
              <boxGeometry args={[0.05, 0.12, 0.04]} />
              <meshStandardMaterial color={coatDark} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.11, 0.04, 0.18]}>
              <boxGeometry args={[0.03, 0.03, 0.03]} />
              <meshStandardMaterial color="#0a0806" />
            </mesh>
            <mesh position={[0.11, 0.04, 0.18]}>
              <boxGeometry args={[0.03, 0.03, 0.03]} />
              <meshStandardMaterial color="#0a0806" />
            </mesh>
          </group>
        </group>

        {/* Tail */}
        <group ref={tail} position={[0, 0.88, -0.62]}>
          <mesh castShadow position={[0, -0.05, -0.22]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.08, 0.1, 0.45]} />
            <meshStandardMaterial color={mane} roughness={0.92} />
          </mesh>
          <mesh castShadow position={[0, -0.18, -0.42]} rotation={[0.75, 0, 0]}>
            <boxGeometry args={[0.1, 0.08, 0.28]} />
            <meshStandardMaterial color={mane} roughness={0.92} />
          </mesh>
        </group>

        {/* Legs */}
        <Leg
          side={-1}
          z={0.38}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind={false}
          bind={(hip, knee) => {
            fl.current = { hip, knee }
          }}
        />
        <Leg
          side={1}
          z={0.38}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind={false}
          bind={(hip, knee) => {
            fr.current = { hip, knee }
          }}
        />
        <Leg
          side={-1}
          z={-0.38}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind
          bind={(hip, knee) => {
            hl.current = { hip, knee }
          }}
        />
        <Leg
          side={1}
          z={-0.38}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind
          bind={(hip, knee) => {
            hr.current = { hip, knee }
          }}
        />

        {/* Jockey silhouette */}
        <group ref={jockey} position={[0, 0.92, -0.02]}>
          {/* Crouched torso in silks */}
          <mesh castShadow position={[0, 0.28, 0.05]} rotation={[0.55, 0, 0]}>
            <boxGeometry args={[0.28, 0.32, 0.22]} />
            <meshStandardMaterial color={horse.jersey} roughness={0.55} metalness={0.1} />
          </mesh>
          {/* Helmet */}
          <mesh castShadow position={[0, 0.52, 0.18]}>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color={horse.jersey} roughness={0.45} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.48, 0.18]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#e8c4a8" roughness={0.7} />
          </mesh>
          {/* Arms to reins */}
          <mesh castShadow position={[-0.18, 0.3, 0.22]} rotation={[0.6, 0.3, 0.4]}>
            <boxGeometry args={[0.07, 0.07, 0.32]} />
            <meshStandardMaterial color={horse.jersey} />
          </mesh>
          <mesh castShadow position={[0.18, 0.3, 0.22]} rotation={[0.6, -0.3, -0.4]}>
            <boxGeometry args={[0.07, 0.07, 0.32]} />
            <meshStandardMaterial color={horse.jersey} />
          </mesh>
          {/* Breeches / boots */}
          <mesh castShadow position={[0, 0.08, -0.02]} rotation={[0.2, 0, 0]}>
            <boxGeometry args={[0.24, 0.16, 0.2]} />
            <meshStandardMaterial color="#f0ebe3" roughness={0.7} />
          </mesh>
          <mesh castShadow position={[-0.1, -0.02, 0.02]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.08, 0.2, 0.08]} />
            <meshStandardMaterial color="#1a1410" />
          </mesh>
          <mesh castShadow position={[0.1, -0.02, 0.02]} rotation={[0.5, 0, 0]}>
            <boxGeometry args={[0.08, 0.2, 0.08]} />
            <meshStandardMaterial color="#1a1410" />
          </mesh>
        </group>
      </group>

      {/* Number plate */}
      <Billboard position={[0, 1.85, 0]} follow>
        <Text
          fontSize={0.32}
          color="#f7f2e8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.028}
          outlineColor="#0f1c3a"
        >
          {String(horse.number)}
        </Text>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.5, 0.4]} />
          <meshBasicMaterial color={horse.jersey} transparent opacity={0.92} />
        </mesh>
      </Billboard>
    </group>
  )
}

function Leg({
  side,
  z,
  coat,
  coatDark,
  sock,
  hoof,
  hind,
  bind,
}: {
  side: number
  z: number
  coat: string
  coatDark: string
  sock: string
  hoof: string
  hind: boolean
  bind: (hip: THREE.Group, knee: THREE.Group) => void
}) {
  const hip = useRef<THREE.Group>(null)
  const knee = useRef<THREE.Group>(null)
  const bound = useRef(false)

  // Bind once groups exist (first commit after mount)
  useFrame(() => {
    if (!bound.current && hip.current && knee.current) {
      bind(hip.current, knee.current)
      bound.current = true
    }
  })

  const hipY = hind ? 0.62 : 0.64
  const upperLen = hind ? 0.34 : 0.32
  const lowerLen = 0.3

  return (
    <group ref={hip} position={[side * 0.14, hipY, z]}>
      {/* Upper limb */}
      <mesh castShadow position={[0, -upperLen * 0.5, 0]}>
        <boxGeometry args={[0.1, upperLen, 0.12]} />
        <meshStandardMaterial color={coat} roughness={0.82} />
      </mesh>
      <group ref={knee} position={[0, -upperLen, 0]}>
        <mesh castShadow position={[0, -lowerLen * 0.45, 0]}>
          <boxGeometry args={[0.08, lowerLen * 0.9, 0.08]} />
          <meshStandardMaterial color={coatDark} roughness={0.8} />
        </mesh>
        {/* Fetlock / sock */}
        <mesh castShadow position={[0, -lowerLen * 0.92, 0]}>
          <boxGeometry args={[0.075, 0.1, 0.075]} />
          <meshStandardMaterial color={sock} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, -lowerLen - 0.04, 0.01]}>
          <boxGeometry args={[0.09, 0.07, 0.12]} />
          <meshStandardMaterial color={hoof} roughness={0.55} />
        </mesh>
      </group>
    </group>
  )
}

function applyLeg(leg: LegRefs | null, swing: number, hind: boolean) {
  if (!leg) return
  // Hip swings in pitch; hind has slightly larger reach
  const hipAmp = hind ? 0.72 : 0.62
  const kneeBase = hind ? 0.35 : 0.25
  const kneeAmp = hind ? 0.85 : 0.95
  leg.hip.rotation.x = swing * hipAmp
  // Knee folds more on the recovery (negative swing)
  const fold = Math.max(0, -swing)
  leg.knee.rotation.x = kneeBase + fold * kneeAmp
}

function darken(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  c.multiplyScalar(1 - amount)
  return `#${c.getHexString()}`
}

function lighten(hex: string, amount: number): string {
  const c = new THREE.Color(hex)
  c.lerp(new THREE.Color('#ffffff'), amount)
  return `#${c.getHexString()}`
}
