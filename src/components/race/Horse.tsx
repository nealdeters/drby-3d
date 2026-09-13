import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from './trackMath'
import { trackPoint, trackTangent } from './trackMath'
import { GATE_POSE, sampleGallop, wrap01, type GallopSample } from './gallop'

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

type JockeyRefs = {
  hips: THREE.Group
  torso: THREE.Group
  helm: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  thighL: THREE.Group
  thighR: THREE.Group
}

/**
 * Low-poly thoroughbred with a left-lead transverse gallop:
 * hind→hind→fore→fore, then a suspension beat. Jockey is a two-point seat.
 */
export function HorseMesh({ horse, index, fieldRef }: Props) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const neck = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const jockey = useRef<THREE.Group>(null)
  const jockeyBits = useRef<JockeyRefs | null>(null)

  const fl = useRef<LegRefs | null>(null)
  const fr = useRef<LegRefs | null>(null)
  const hl = useRef<LegRefs | null>(null)
  const hr = useRef<LegRefs | null>(null)

  const gait = useRef(Math.random())

  const coat = horse.coat
  const coatDark = useMemo(() => darken(coat, 0.22), [coat])
  const coatLight = useMemo(() => lighten(coat, 0.12), [coat])
  const sock = '#f2eee6'
  const hoof = '#1a1410'
  const mane = coatDark
  const numeralColor = useMemo(
    () => (plateLuminance(horse.jersey) > 0.55 ? '#0a1220' : '#ffffff'),
    [horse.jersey],
  )
  const numeralOutline = useMemo(
    () => (plateLuminance(horse.jersey) > 0.55 ? '#ffffff' : '#0a1220'),
    [horse.jersey],
  )

  useFrame((_, dt) => {
    if (!root.current) return
    const s = fieldRef.current.find((st) => st.id === horse.id) ?? fieldRef.current[index]
    if (!s) return

    const pos = trackPoint(s.progress, s.radial)
    const tan = trackTangent(s.progress, s.radial)
    root.current.rotation.y = Math.atan2(tan.x, tan.z)

    // At the gate (pace ~0) stand still — no walking in place before the break.
    if (s.pace <= 0.08) {
      applyPose(GATE_POSE)
      root.current.position.set(pos.x, 0.12, pos.z)
      root.current.rotation.z = 0
      root.current.rotation.x = 0
      return
    }

    const strideHz = 2.35 + s.pace * 2.15
    gait.current = wrap01(gait.current + dt * strideHz)
    const pose = sampleGallop(gait.current)
    applyPose(pose)
    root.current.position.set(pos.x, 0.12 + pose.bob, pos.z)
    root.current.rotation.z = pose.barrelRoll
    root.current.rotation.x = pose.barrelPitch * 0.45
  })

  function applyPose(pose: GallopSample) {
    applyLeg(hl.current, pose.swing.hl, pose.knee.hl)
    applyLeg(hr.current, pose.swing.hr, pose.knee.hr)
    applyLeg(fl.current, pose.swing.fl, pose.knee.fl)
    applyLeg(fr.current, pose.swing.fr, pose.knee.fr)

    if (body.current) {
      body.current.position.y = pose.gather * 0.028
      body.current.rotation.x = pose.barrelPitch
    }
    if (neck.current) neck.current.rotation.x = 0.35 + pose.neckPitch
    if (head.current) head.current.rotation.x = -0.15 + pose.headPitch
    if (tail.current) {
      tail.current.rotation.x = 0.35 + pose.tailPitch
      tail.current.rotation.y = pose.tailYaw
    }
    if (jockey.current) {
      jockey.current.position.set(0, 0.92 + pose.hipY, -0.02 + pose.hipZ)
      jockey.current.rotation.x = 0.12 + pose.foldDelta * 0.25
    }
    const j = jockeyBits.current
    if (j) {
      j.hips.position.y = pose.hipY * 0.15
      j.torso.rotation.x = 0.55 + pose.foldDelta
      j.helm.rotation.x = pose.helmetPitch
      j.armL.rotation.x = 0.55 + pose.armGive
      j.armR.rotation.x = 0.55 + pose.armGive
      j.thighL.rotation.x = 0.85 + pose.thighDelta
      j.thighR.rotation.x = 0.85 + pose.thighDelta
    }
  }

  return (
    <group ref={root} frustumCulled={false}>
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

        {/* Two-point jockey: hips over irons, folded torso, helmet quieter than the seat */}
        <group ref={jockey} position={[0, 0.92, -0.02]}>
          <JockeySilks
            jersey={horse.jersey}
            bind={(bits) => {
              jockeyBits.current = bits
            }}
          />
        </group>
      </group>

      {/* Number plate — larger high-contrast jersey + white/black numeral */}
      <Billboard position={[0, 2.05, 0]} follow frustumCulled={false}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[0.78, 0.62]} />
          <meshBasicMaterial color="#0a1220" />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.7, 0.54]} />
          <meshBasicMaterial color={horse.jersey} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.46}
          color={numeralColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.04}
          outlineColor={numeralOutline}
          fontWeight={700}
        >
          {String(horse.number)}
        </Text>
      </Billboard>
    </group>
  )
}

function JockeySilks({
  jersey,
  bind,
}: {
  jersey: string
  bind: (bits: JockeyRefs) => void
}) {
  const hips = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const helm = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const thighL = useRef<THREE.Group>(null)
  const thighR = useRef<THREE.Group>(null)
  const bound = useRef(false)

  useFrame(() => {
    if (
      !bound.current &&
      hips.current &&
      torso.current &&
      helm.current &&
      armL.current &&
      armR.current &&
      thighL.current &&
      thighR.current
    ) {
      bind({
        hips: hips.current,
        torso: torso.current,
        helm: helm.current,
        armL: armL.current,
        armR: armR.current,
        thighL: thighL.current,
        thighR: thighR.current,
      })
      bound.current = true
    }
  })

  return (
    <group ref={hips}>
      <group ref={thighL} position={[-0.1, -0.02, 0.04]} rotation={[0.85, 0.08, 0.12]}>
        <mesh castShadow position={[0, -0.1, 0.02]}>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
      </group>
      <group ref={thighR} position={[0.1, -0.02, 0.04]} rotation={[0.85, -0.08, -0.12]}>
        <mesh castShadow position={[0, -0.1, 0.02]}>
          <boxGeometry args={[0.08, 0.2, 0.08]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
      </group>
      <mesh castShadow position={[0, 0.08, -0.02]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[0.24, 0.16, 0.2]} />
        <meshStandardMaterial color="#f0ebe3" roughness={0.7} />
      </mesh>
      <group ref={torso} position={[0, 0.22, 0.02]} rotation={[0.55, 0, 0]}>
        <mesh castShadow position={[0, 0.1, 0.04]}>
          <boxGeometry args={[0.28, 0.32, 0.22]} />
          <meshStandardMaterial color={jersey} roughness={0.55} metalness={0.1} />
        </mesh>
        <group ref={armL} position={[-0.16, 0.08, 0.12]} rotation={[0.55, 0.28, 0.35]}>
          <mesh castShadow position={[0, 0, 0.14]}>
            <boxGeometry args={[0.07, 0.07, 0.32]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
        </group>
        <group ref={armR} position={[0.16, 0.08, 0.12]} rotation={[0.55, -0.28, -0.35]}>
          <mesh castShadow position={[0, 0, 0.14]}>
            <boxGeometry args={[0.07, 0.07, 0.32]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
        </group>
        <group ref={helm} position={[0, 0.28, 0.14]}>
          <mesh castShadow>
            <sphereGeometry args={[0.11, 10, 10]} />
            <meshStandardMaterial color={jersey} roughness={0.45} metalness={0.15} />
          </mesh>
          <mesh position={[0, -0.04, 0.02]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#e8c4a8" roughness={0.7} />
          </mesh>
        </group>
      </group>
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
      <mesh castShadow position={[0, -upperLen * 0.5, 0]}>
        <boxGeometry args={[0.1, upperLen, 0.12]} />
        <meshStandardMaterial color={coat} roughness={0.82} />
      </mesh>
      <group ref={knee} position={[0, -upperLen, 0]}>
        <mesh castShadow position={[0, -lowerLen * 0.45, 0]}>
          <boxGeometry args={[0.08, lowerLen * 0.9, 0.08]} />
          <meshStandardMaterial color={coatDark} roughness={0.8} />
        </mesh>
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

function applyLeg(leg: LegRefs | null, swing: number, knee: number) {
  if (!leg) return
  leg.hip.rotation.x = swing
  leg.knee.rotation.x = knee
}

function plateLuminance(hex: string): number {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
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
