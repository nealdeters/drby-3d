import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from './trackMath'
import { trackPoint, trackTangent } from './trackMath'
import { GATE_POSE, sampleLocomotion, wrap01, type GallopSample } from './gallop'

type Props = {
  horse: HorseData
  index: number
  fieldRef: MutableRefObject<HorseSimState[]>
  onPick?: (id: string) => void
  selected?: boolean
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

/** Equestrian-yard riding horse is ~1.62 m at the withers, ~2.89 m nose-to-tail. */
const HORSE_SCALE = 0.62
const STAND_URL = '/models/horse-stand.glb'
const TROT_URL = '/models/horse-trot.glb'

let morphPrepared = false

function meshList(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = []
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) out.push(o as THREE.Mesh)
  })
  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}

/** Stand and trot share topology — copy trot positions on as an absolute morph. */
function prepareStandTrotMorph(stand: THREE.Object3D, trot: THREE.Object3D) {
  if (morphPrepared) return
  const a = meshList(stand)
  const b = meshList(trot)
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const ga = a[i].geometry
    const gb = b[i].geometry
    const pa = ga.getAttribute('position')
    const pb = gb.getAttribute('position')
    if (!pa || !pb || pa.count !== pb.count) continue
    ga.morphAttributes.position = [pb]
    ga.morphTargetsRelative = false
  }
  morphPrepared = true
}

function cloneHorse(stand: THREE.Object3D, coat: string): THREE.Object3D {
  const root = stand.clone(true)
  const coatColor = new THREE.Color(coat)
  const coatDark = coatColor.clone().multiplyScalar(0.78)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.morphTargetInfluences = [0]
    const mat = mesh.material
    const src = Array.isArray(mat) ? mat[0] : mat
    if (!src) return
    const next = (src as THREE.Material).clone() as THREE.MeshStandardMaterial
    const name = (src.name || '').toLowerCase()
    if (name === 'bay' || name.includes('hide') || name.includes('coat')) {
      next.color = coatColor.clone()
      next.roughness = 0.62
    } else if (name.includes('timber')) {
      next.color = new THREE.Color('#3a2a1c')
      next.roughness = 0.7
    } else if (name === 'black') {
      next.color = coatDark
      next.roughness = 0.55
    }
    mesh.material = next
  })
  return root
}

function setMorph(root: THREE.Object3D, t: number) {
  const v = THREE.MathUtils.clamp(t, 0, 1)
  root.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh && mesh.morphTargetInfluences && mesh.morphTargetInfluences.length) {
      mesh.morphTargetInfluences[0] = v
    }
  })
}

/**
 * CC0 riding-horse reference (3dassets.dev equestrian yard) with a two-point
 * silks jockey. Gate = stand morph 0; race pace morphs stand↔trot on the stride.
 */
export function HorseMesh({ horse, index, fieldRef, onPick, selected }: Props) {
  const standGltf = useGLTF(STAND_URL)
  const trotGltf = useGLTF(TROT_URL)
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const horseRoot = useRef<THREE.Group>(null)
  const jockey = useRef<THREE.Group>(null)
  const jockeyBits = useRef<JockeyRefs | null>(null)
  const gait = useRef(Math.random())

  useEffect(() => {
    prepareStandTrotMorph(standGltf.scene, trotGltf.scene)
  }, [standGltf.scene, trotGltf.scene])

  const cloned = useMemo(() => cloneHorse(standGltf.scene, horse.coat), [standGltf.scene, horse.coat])

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

    if (s.pace <= 0.08) {
      applyPose(GATE_POSE)
      if (horseRoot.current) setMorph(horseRoot.current, 0)
      root.current.position.set(pos.x, 0, pos.z)
      root.current.rotation.z = 0
      root.current.rotation.x = 0
      return
    }

    const strideHz = s.pace < 1.05 ? 2.55 + s.pace * 0.7 : 2.35 + s.pace * 2.15
    gait.current = wrap01(gait.current + dt * strideHz)
    const pose = sampleLocomotion(gait.current, s.pace)
    applyPose(pose)
    // 2-beat: ping-pong stand → full diagonal trot. Kick just runs it faster.
    const beat = Math.abs(Math.sin(gait.current * Math.PI * 2))
    const influence = 0.28 + 0.72 * beat
    if (horseRoot.current) setMorph(horseRoot.current, influence)
    root.current.position.set(pos.x, pose.bob * 0.55, pos.z)
    root.current.rotation.z = pose.barrelRoll * 0.65
    root.current.rotation.x = pose.barrelPitch * 0.35
  })

  function applyPose(pose: GallopSample) {
    if (body.current) {
      body.current.position.y = pose.gather * 0.02
      body.current.rotation.x = pose.barrelPitch * 0.4
    }
    if (jockey.current) {
      jockey.current.position.set(0, 1.52 + pose.hipY * 0.8, -0.06 + pose.hipZ * 0.8)
      jockey.current.rotation.x = 0.22 + pose.foldDelta * 0.25
    }
    const j = jockeyBits.current
    if (j) {
      j.hips.position.y = pose.hipY * 0.12
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
      <group ref={body} scale={HORSE_SCALE}>
        <group ref={horseRoot}>
          <primitive object={cloned} />
        </group>
        <group ref={jockey} position={[0, 1.52, -0.06]} scale={1.35}>
          <JockeySilks
            jersey={horse.jersey}
            bind={(bits) => {
              jockeyBits.current = bits
            }}
          />
        </group>
      </group>

      {selected ? (
        <mesh position={[0, 2.15, 0]}>
          <sphereGeometry args={[0.16, 12, 10]} />
          <meshBasicMaterial color="#ffe08a" />
        </mesh>
      ) : null}
      <Billboard position={[0, 1.72, 0]} follow frustumCulled={false}>
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

useGLTF.preload(STAND_URL)
useGLTF.preload(TROT_URL)

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

function plateLuminance(hex: string): number {
  const c = new THREE.Color(hex)
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
}
