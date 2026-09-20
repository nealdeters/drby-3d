import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from './trackMath'
import { trackPoint, trackTangent } from './trackMath'
import { GATE_POSE, sampleLocomotion, wrap01, type GallopSample } from './gallop'

type Props = {
  horse: HorseData
  index: number
  /** Shared mutable field state — read by index each frame */
  fieldRef: MutableRefObject<HorseSimState[]>
  onPick?: (id: string) => void
  selected?: boolean
}

type LegRefs = {
  hip: THREE.Group
  knee: THREE.Group
  fetlock: THREE.Group
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
 * Thoroughbred silhouette (capsules/cylinders) with a two-beat diagonal trot
 * that blends into the left-lead gallop on the stretch kick. Jockey is a
 * two-point seat in silks.
 */
export function HorseMesh({ horse, index, fieldRef, onPick, selected }: Props) {
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

    const strideHz = s.pace < 1.05 ? 2.55 + s.pace * 0.7 : 2.35 + s.pace * 2.15
    gait.current = wrap01(gait.current + dt * strideHz)
    const pose = sampleLocomotion(gait.current, s.pace)
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
    if (neck.current) neck.current.rotation.x = 0.28 + pose.neckPitch
    if (head.current) head.current.rotation.x = -0.22 + pose.headPitch
    if (tail.current) {
      tail.current.rotation.x = 0.4 + pose.tailPitch
      tail.current.rotation.y = pose.tailYaw
    }
    if (jockey.current) {
      jockey.current.position.set(0, 1.02 + pose.hipY, -0.04 + pose.hipZ)
      jockey.current.rotation.x = 0.18 + pose.foldDelta * 0.25
    }
    const j = jockeyBits.current
    if (j) {
      j.hips.position.y = pose.hipY * 0.15
      j.torso.rotation.x = 0.62 + pose.foldDelta
      j.helm.rotation.x = pose.helmetPitch
      j.armL.rotation.x = 0.35 + pose.armGive
      j.armR.rotation.x = 0.35 + pose.armGive
      j.thighL.rotation.x = 0.92 + pose.thighDelta
      j.thighR.rotation.x = 0.92 + pose.thighDelta
    }
  }

  return (
    <group
      ref={root}
      onClick={(e) => {
        e.stopPropagation()
        onPick?.(horse.id)
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <group ref={body}>
        {/* Barrel — long thoroughbred torso */}
        <mesh castShadow position={[0, 0.78, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.2, 0.7, 5, 10]} />
          <meshStandardMaterial color={coat} roughness={0.62} />
        </mesh>
        {/* Chest / shoulder */}
        <mesh castShadow position={[0, 0.76, 0.46]}>
          <sphereGeometry args={[0.22, 10, 8]} />
          <meshStandardMaterial color={coatLight} roughness={0.6} />
        </mesh>
        {/* Croup */}
        <mesh castShadow position={[0, 0.8, -0.42]} scale={[1, 0.92, 1.05]}>
          <sphereGeometry args={[0.2, 10, 8]} />
          <meshStandardMaterial color={coat} roughness={0.62} />
        </mesh>
        {/* Belly tuck */}
        <mesh castShadow position={[0, 0.58, 0.02]} rotation={[Math.PI / 2, 0, 0]} scale={[0.85, 1, 0.7]}>
          <capsuleGeometry args={[0.14, 0.42, 4, 8]} />
          <meshStandardMaterial color={coatDark} roughness={0.7} />
        </mesh>

        {/* Saddle + cloth (silks) */}
        <mesh castShadow position={[0, 0.98, -0.04]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[0.08, 0.22, 4, 8]} />
          <meshStandardMaterial color="#2a2118" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 0.96, -0.02]}>
          <boxGeometry args={[0.48, 0.035, 0.4]} />
          <meshStandardMaterial color={horse.jersey} roughness={0.5} metalness={0.08} />
        </mesh>

        {/* Neck — longer, arched */}
        <group ref={neck} position={[0, 0.92, 0.52]}>
          <mesh castShadow position={[0, 0.16, 0.22]} rotation={[0.85, 0, 0]}>
            <capsuleGeometry args={[0.09, 0.42, 5, 8]} />
            <meshStandardMaterial color={coat} roughness={0.6} />
          </mesh>
          {/* Mane along the crest */}
          <mesh castShadow position={[0, 0.26, 0.16]} rotation={[0.9, 0, 0]}>
            <capsuleGeometry args={[0.035, 0.38, 4, 6]} />
            <meshStandardMaterial color={mane} roughness={0.88} />
          </mesh>
          <mesh castShadow position={[0, 0.34, 0.08]} rotation={[0.55, 0, 0]}>
            <sphereGeometry args={[0.05, 6, 6]} />
            <meshStandardMaterial color={mane} roughness={0.9} />
          </mesh>

          {/* Head */}
          <group ref={head} position={[0, 0.34, 0.5]}>
            <mesh castShadow position={[0, 0.02, 0.04]}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial color={coatDark} roughness={0.58} />
            </mesh>
            <mesh castShadow position={[0, -0.01, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.07, 0.16, 4, 8]} />
              <meshStandardMaterial color={coatLight} roughness={0.55} />
            </mesh>
            <mesh castShadow position={[0, -0.03, 0.3]}>
              <sphereGeometry args={[0.055, 8, 6]} />
              <meshStandardMaterial color={coatLight} roughness={0.55} />
            </mesh>
            <mesh castShadow position={[0, -0.05, 0.35]}>
              <sphereGeometry args={[0.032, 6, 6]} />
              <meshStandardMaterial color="#1c1612" roughness={0.5} />
            </mesh>
            {/* Ears */}
            <mesh castShadow position={[-0.055, 0.13, -0.02]} rotation={[0.35, 0, -0.25]}>
              <coneGeometry args={[0.028, 0.1, 5]} />
              <meshStandardMaterial color={coatDark} />
            </mesh>
            <mesh castShadow position={[0.055, 0.13, -0.02]} rotation={[0.35, 0, 0.25]}>
              <coneGeometry args={[0.028, 0.1, 5]} />
              <meshStandardMaterial color={coatDark} />
            </mesh>
            {/* Eyes */}
            <mesh position={[-0.075, 0.03, 0.1]}>
              <sphereGeometry args={[0.018, 6, 6]} />
              <meshStandardMaterial color="#0a0806" />
            </mesh>
            <mesh position={[0.075, 0.03, 0.1]}>
              <sphereGeometry args={[0.018, 6, 6]} />
              <meshStandardMaterial color="#0a0806" />
            </mesh>
          </group>
        </group>

        {/* Tail */}
        <group ref={tail} position={[0, 0.88, -0.58]}>
          <mesh castShadow position={[0, -0.08, -0.18]} rotation={[0.85, 0, 0]}>
            <capsuleGeometry args={[0.04, 0.32, 4, 6]} />
            <meshStandardMaterial color={mane} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, -0.22, -0.38]} rotation={[1.05, 0, 0]}>
            <capsuleGeometry args={[0.05, 0.2, 4, 6]} />
            <meshStandardMaterial color={mane} roughness={0.9} />
          </mesh>
        </group>

        <Leg
          side={-1}
          z={0.36}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind={false}
          bind={(hip, knee, fetlock) => {
            fl.current = { hip, knee, fetlock }
          }}
        />
        <Leg
          side={1}
          z={0.36}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind={false}
          bind={(hip, knee, fetlock) => {
            fr.current = { hip, knee, fetlock }
          }}
        />
        <Leg
          side={-1}
          z={-0.36}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind
          bind={(hip, knee, fetlock) => {
            hl.current = { hip, knee, fetlock }
          }}
        />
        <Leg
          side={1}
          z={-0.36}
          coat={coat}
          coatDark={coatDark}
          sock={sock}
          hoof={hoof}
          hind
          bind={(hip, knee, fetlock) => {
            hr.current = { hip, knee, fetlock }
          }}
        />

        <group ref={jockey} position={[0, 1.02, -0.04]}>
          <JockeySilks
            jersey={horse.jersey}
            bind={(bits) => {
              jockeyBits.current = bits
            }}
          />
        </group>
      </group>

      {selected ? (
        <mesh position={[0, 2.55, 0]}>
          <sphereGeometry args={[0.18, 12, 10]} />
          <meshBasicMaterial color="#ffe08a" />
        </mesh>
      ) : null}
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
  const skin = '#e8c4a8'
  const boot = '#1a1410'
  const breech = '#f0ebe3'

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
      {/* Two-point: thighs along the barrel, boots in the irons */}
      <group ref={thighL} position={[-0.11, -0.02, 0.05]} rotation={[0.92, 0.1, 0.14]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.04, 0.16, 4, 6]} />
          <meshStandardMaterial color={breech} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.26, 0.02]} rotation={[0.35, 0, 0]}>
          <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
          <meshStandardMaterial color={boot} roughness={0.55} />
        </mesh>
      </group>
      <group ref={thighR} position={[0.11, -0.02, 0.05]} rotation={[0.92, -0.1, -0.14]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.04, 0.16, 4, 6]} />
          <meshStandardMaterial color={breech} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.26, 0.02]} rotation={[0.35, 0, 0]}>
          <capsuleGeometry args={[0.035, 0.12, 4, 6]} />
          <meshStandardMaterial color={boot} roughness={0.55} />
        </mesh>
      </group>
      <mesh castShadow position={[0, 0.06, -0.02]} rotation={[0.25, 0, 0]}>
        <sphereGeometry args={[0.09, 8, 8]} />
        <meshStandardMaterial color={breech} roughness={0.7} />
      </mesh>
      <group ref={torso} position={[0, 0.16, 0.02]} rotation={[0.62, 0, 0]}>
        <mesh castShadow position={[0, 0.12, 0.03]}>
          <capsuleGeometry args={[0.09, 0.16, 5, 8]} />
          <meshStandardMaterial color={jersey} roughness={0.5} metalness={0.1} />
        </mesh>
        <group ref={armL} position={[-0.12, 0.12, 0.08]} rotation={[0.35, 0.32, 0.4]}>
          <mesh castShadow position={[0, 0, 0.13]}>
            <capsuleGeometry args={[0.032, 0.2, 4, 6]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
          <mesh castShadow position={[0, 0, 0.26]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={armR} position={[0.12, 0.12, 0.08]} rotation={[0.35, -0.32, -0.4]}>
          <mesh castShadow position={[0, 0, 0.13]}>
            <capsuleGeometry args={[0.032, 0.2, 4, 6]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
          <mesh castShadow position={[0, 0, 0.26]}>
            <sphereGeometry args={[0.028, 6, 6]} />
            <meshStandardMaterial color={skin} />
          </mesh>
        </group>
        <group ref={helm} position={[0, 0.28, 0.12]}>
          <mesh castShadow>
            <sphereGeometry args={[0.095, 10, 10]} />
            <meshStandardMaterial color={jersey} roughness={0.4} metalness={0.18} />
          </mesh>
          {/* visor */}
          <mesh position={[0, -0.01, 0.08]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.14, 0.045, 0.08]} />
            <meshStandardMaterial color="#14110e" roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh position={[0, -0.05, 0.03]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={skin} roughness={0.7} />
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
  bind: (hip: THREE.Group, knee: THREE.Group, fetlock: THREE.Group) => void
}) {
  const hip = useRef<THREE.Group>(null)
  const knee = useRef<THREE.Group>(null)
  const fetlock = useRef<THREE.Group>(null)
  const bound = useRef(false)

  useFrame(() => {
    if (!bound.current && hip.current && knee.current && fetlock.current) {
      bind(hip.current, knee.current, fetlock.current)
      bound.current = true
    }
  })

  const hipY = hind ? 0.66 : 0.68
  const upperLen = hind ? 0.36 : 0.34
  const lowerLen = 0.28
  const upperR = hind ? 0.055 : 0.048

  return (
    <group ref={hip} position={[side * 0.13, hipY, z]}>
      <mesh castShadow position={[0, -upperLen * 0.5, 0]}>
        <capsuleGeometry args={[upperR, upperLen * 0.72, 4, 8]} />
        <meshStandardMaterial color={coat} roughness={0.62} />
      </mesh>
      <group ref={knee} position={[0, -upperLen, 0]}>
        <mesh castShadow position={[0, -lowerLen * 0.42, 0]}>
          <capsuleGeometry args={[0.032, lowerLen * 0.55, 4, 6]} />
          <meshStandardMaterial color={coatDark} roughness={0.6} />
        </mesh>
        <group ref={fetlock} position={[0, -lowerLen * 0.85, 0]}>
          <mesh castShadow position={[0, -0.05, 0]}>
            <capsuleGeometry args={[0.028, 0.07, 4, 6]} />
            <meshStandardMaterial color={sock} roughness={0.75} />
          </mesh>
          <mesh castShadow position={[0, -0.1, 0.02]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[0.07, 0.045, 0.1]} />
            <meshStandardMaterial color={hoof} roughness={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function applyLeg(leg: LegRefs | null, swing: number, knee: number) {
  if (!leg) return
  leg.hip.rotation.x = swing
  leg.knee.rotation.x = knee
  // Fetlock breaks over in late stance (positive swing) and stays quiet in flight.
  leg.fetlock.rotation.x = 0.08 + Math.max(0, swing) * 0.22
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
