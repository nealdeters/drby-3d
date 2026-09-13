import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from '../race/trackMath'
import { trackPoint, trackTangent } from '../race/trackMath'
import { GATE_POSE, sampleGallop, wrap01, type GallopSample } from '../race/gallop'
import { ensureGallopAttributes } from './gallopTag'

const HORSE_URL = '/tv/models/riding-horse.glb'

type Props = {
  horse: HorseData
  index: number
  fieldRef: MutableRefObject<HorseSimState[]>
}

type GallopRig = {
  swing: THREE.Vector4
  knee: THREE.Vector4
  spine: THREE.Vector4
  tail: THREE.Vector2
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

function bindGallopMaterials(root: THREE.Object3D): GallopRig {
  const existing = root.userData.gallop as GallopRig | undefined
  if (existing) return existing
  const rig: GallopRig = {
    swing: new THREE.Vector4(),
    knee: new THREE.Vector4(),
    spine: new THREE.Vector4(),
    tail: new THREE.Vector2(),
  }
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial
      if (!mat || mat.userData.tvGallopShader) continue
      mat.userData.tvGallopShader = true
      mat.customProgramCacheKey = () => 'tv-gallop-v4'
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uLegSwing = { value: rig.swing }
        shader.uniforms.uLegKnee = { value: rig.knee }
        shader.uniforms.uSpine = { value: rig.spine }
        shader.uniforms.uTail = { value: rig.tail }
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
attribute float legId;
attribute vec3 legPivot;
attribute float legAlong;
attribute float partId;
attribute vec3 partPivot;
uniform vec4 uLegSwing;
uniform vec4 uLegKnee;
uniform vec4 uSpine;
uniform vec2 uTail;
void tvRx(inout vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  float y = p.y;
  float z = p.z;
  p.y = c * y - s * z;
  p.z = s * y + c * z;
}
void tvRy(inout vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  float x = p.x;
  float z = p.z;
  p.x = c * x + s * z;
  p.z = -s * x + c * z;
}
`,
          )
          .replace(
            '#include <begin_vertex>',
            `vec3 transformed = vec3(position);
if (legId > 0.5) {
  float swing = 0.0;
  float knee = 0.0;
  if (legId < 1.5) { swing = uLegSwing.x; knee = uLegKnee.x; }
  else if (legId < 2.5) { swing = uLegSwing.y; knee = uLegKnee.y; }
  else if (legId < 3.5) { swing = uLegSwing.z; knee = uLegKnee.z; }
  else { swing = uLegSwing.w; knee = uLegKnee.w; }
  vec3 p = transformed - legPivot;
  // Rotate the rest-space knee offset with the hip so the joint stays on the bone.
  vec3 k = vec3(0.0, -0.38, 0.0);
  tvRx(k, swing);
  tvRx(p, swing);
  if (legAlong > 0.36) {
    vec3 q = p - k;
    tvRx(q, knee);
    p = q + k;
  }
  transformed = p + legPivot;
} else if (partId > 4.5) {
  vec3 p = transformed - partPivot;
  if (partId < 5.5) {
    tvRx(p, uSpine.z);
  } else if (partId < 6.5) {
    tvRx(p, uSpine.z + uSpine.w);
  } else {
    tvRx(p, uTail.x);
    tvRy(p, uTail.y);
  }
  transformed = p + partPivot;
}
`,
          )
          .replace(
            '#include <beginnormal_vertex>',
            `vec3 objectNormal = vec3(normal);
#ifdef USE_TANGENT
  vec3 objectTangent = vec3(tangent.xyz);
#endif
if (legId > 0.5) {
  float swing = 0.0;
  float knee = 0.0;
  if (legId < 1.5) { swing = uLegSwing.x; knee = uLegKnee.x; }
  else if (legId < 2.5) { swing = uLegSwing.y; knee = uLegKnee.y; }
  else if (legId < 3.5) { swing = uLegSwing.z; knee = uLegKnee.z; }
  else { swing = uLegSwing.w; knee = uLegKnee.w; }
  tvRx(objectNormal, swing);
  if (legAlong > 0.36) tvRx(objectNormal, knee);
#ifdef USE_TANGENT
  tvRx(objectTangent, swing);
  if (legAlong > 0.36) tvRx(objectTangent, knee);
#endif
} else if (partId > 4.5) {
  float a = 0.0;
  if (partId < 5.5) a = uSpine.z;
  else if (partId < 6.5) a = uSpine.z + uSpine.w;
  else a = uTail.x;
  tvRx(objectNormal, a);
#ifdef USE_TANGENT
  tvRx(objectTangent, a);
#endif
}
`,
          )
      }
      mat.needsUpdate = true
    }
  })
  root.userData.gallop = rig
  return rig
}

function cloneHorse(scene: THREE.Object3D, coatHex: string) {
  ensureGallopAttributes(scene)
  const root = scene.clone(true)
  const coat = new THREE.Color(coatHex)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    const mats = (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).map((m) => {
      const mm = (m as THREE.MeshStandardMaterial).clone()
      const name = `${mm.name ?? ''} ${mesh.name ?? ''}`
      const skip =
        (typeof mm.metalness === 'number' && mm.metalness > 0.4) ||
        /timber|metal|leather|tack/i.test(name)
      if (!skip && mm.color && /hide/i.test(name)) mm.color.lerp(coat, 0.7)
      return mm
    })
    mesh.material = Array.isArray(mesh.material) ? mats : mats[0]
  })
  bindGallopMaterials(root)
  return root
}

function plateLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function applyGallop(rig: GallopRig | undefined, pose: GallopSample | null) {
  if (!rig) return
  if (!pose) {
    rig.swing.set(0, 0, 0, 0)
    rig.knee.set(0, 0, 0, 0)
    rig.spine.set(0, 0, 0, 0)
    rig.tail.set(0, 0)
    return
  }
  rig.swing.set(pose.swing.fl, pose.swing.fr, pose.swing.hl, pose.swing.hr)
  rig.knee.set(pose.knee.fl, pose.knee.fr, pose.knee.hl, pose.knee.hr)
  rig.spine.set(0, 0, pose.neckPitch * 0.85, pose.headPitch * 0.85)
  rig.tail.set(pose.tailPitch * 0.55, pose.tailYaw * 0.7)
}

export function Thoroughbred({ horse, index, fieldRef }: Props) {
  const root = useRef<THREE.Group>(null)
  const jockey = useRef<THREE.Group>(null)
  const jockeyBits = useRef<JockeyRefs | null>(null)
  const gait = useRef(Math.random())
  const gltf = useGLTF(HORSE_URL)
  const inst = useMemo(() => cloneHorse(gltf.scene, horse.coat), [gltf.scene, horse.coat])
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
    root.current.position.set(pos.x, 0, pos.z)
    root.current.rotation.y = Math.atan2(tan.x, tan.z)

    const rig = inst.userData.gallop as GallopRig | undefined
    if (s.pace <= 0.08) {
      applyGallop(rig, GATE_POSE)
      root.current.rotation.x = 0
      root.current.rotation.z = 0
      poseJockey(GATE_POSE)
      return
    }

    const strideHz = 2.35 + s.pace * 1.75
    gait.current = wrap01(gait.current + dt * strideHz)
    const pose = sampleGallop(gait.current)
    applyGallop(rig, pose)
    root.current.position.y = pose.bob
    root.current.rotation.z = pose.barrelRoll
    root.current.rotation.x = pose.barrelPitch
    poseJockey(pose)
  })

  function poseJockey(pose: GallopSample) {
    if (jockey.current) {
      jockey.current.position.set(0, 1.08 + pose.hipY, -0.08 + pose.hipZ)
      jockey.current.rotation.x = 0.55 + pose.foldDelta
    }
    const j = jockeyBits.current
    if (!j) return
    j.hips.position.y = pose.hipY * 0.12
    j.torso.rotation.x = 0.22 + pose.foldDelta * 0.65
    j.helm.rotation.x = pose.helmetPitch
    j.armL.rotation.x = 1.05 + pose.armGive
    j.armR.rotation.x = 1.05 + pose.armGive
    j.thighL.rotation.x = 1.0 + pose.thighDelta
    j.thighR.rotation.x = 1.0 + pose.thighDelta
  }

  return (
    <group ref={root} frustumCulled={false}>
      <primitive object={inst} rotation={[0, 0, 0]} scale={0.52} />
      <mesh castShadow position={[0, 0.92, -0.04]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.42, 0.05, 0.36]} />
        <meshStandardMaterial color={horse.jersey} roughness={0.5} metalness={0.08} />
      </mesh>
      <group ref={jockey} position={[0, 1.08, -0.08]} rotation={[0.55, 0, 0]}>
        <TvJockey
          jersey={horse.jersey}
          bind={(bits) => {
            jockeyBits.current = bits
          }}
        />
      </group>
      <Billboard position={[0, 2.15, 0]} follow frustumCulled={false}>
        <mesh position={[0, 0, -0.03]}>
          <planeGeometry args={[0.86, 0.7]} />
          <meshBasicMaterial color="#0a1220" />
        </mesh>
        <mesh position={[0, 0, -0.02]}>
          <planeGeometry args={[0.76, 0.6]} />
          <meshBasicMaterial color={horse.jersey} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.5}
          color={numeralColor}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.045}
          outlineColor={numeralOutline}
          fontWeight={700}
        >
          {String(horse.number)}
        </Text>
      </Billboard>
    </group>
  )
}

function TvJockey({
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
      <group ref={thighL} position={[-0.06, -0.1, 0.05]} rotation={[1.0, 0.06, 0.1]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.024, 0.14, 3, 6]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
      </group>
      <group ref={thighR} position={[0.06, -0.1, 0.05]} rotation={[1.0, -0.06, -0.1]}>
        <mesh castShadow>
          <capsuleGeometry args={[0.024, 0.14, 3, 6]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
      </group>
      <mesh castShadow position={[0, 0.0, -0.02]}>
        <boxGeometry args={[0.16, 0.08, 0.12]} />
        <meshStandardMaterial color="#f3eee6" roughness={0.7} />
      </mesh>
      <group ref={torso} position={[0, 0.1, 0.02]} rotation={[0.22, 0, 0]}>
        <mesh castShadow position={[0, 0.08, 0.0]} rotation={[0.15, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.14, 5, 8]} />
          <meshStandardMaterial color={jersey} roughness={0.45} metalness={0.12} />
        </mesh>
        <group ref={armL} position={[-0.1, 0.06, 0.08]} rotation={[1.05, 0.4, 0.15]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.024, 0.2, 3, 6]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
        </group>
        <group ref={armR} position={[0.1, 0.06, 0.08]} rotation={[1.05, -0.4, -0.15]}>
          <mesh castShadow>
            <capsuleGeometry args={[0.024, 0.2, 3, 6]} />
            <meshStandardMaterial color={jersey} />
          </mesh>
        </group>
        <group ref={helm} position={[0, 0.2, 0.1]}>
          <mesh castShadow>
            <sphereGeometry args={[0.075, 12, 10]} />
            <meshStandardMaterial color={jersey} roughness={0.38} metalness={0.16} />
          </mesh>
          <mesh position={[0, -0.02, 0.02]}>
            <sphereGeometry args={[0.048, 8, 8]} />
            <meshStandardMaterial color="#e0b090" roughness={0.65} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

useGLTF.preload(HORSE_URL)
