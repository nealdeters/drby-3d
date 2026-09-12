import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse as HorseData } from '../../data/fakeSeason'
import type { HorseSimState } from '../race/trackMath'
import { trackPoint, trackTangent } from '../race/trackMath'

const HORSE_URL = '/tv/models/riding-horse.glb'

type Props = {
  horse: HorseData
  index: number
  fieldRef: MutableRefObject<HorseSimState[]>
}

type GallopRig = {
  swing: THREE.Vector4
  knee: THREE.Vector4
}

const _rootInv = new THREE.Matrix4()
const _meshInv = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _hip = new THREE.Vector3()
const _hoof = new THREE.Vector3()
const _tmp = new THREE.Vector3()

/** Tag hide vertices into FL/FR/HL/HR once on the shared GLB geometry. */
function ensureGallopAttributes(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  _rootInv.copy(root.matrixWorld).invert()

  type Hit = { mesh: THREE.Mesh; i: number; x: number; y: number; z: number }
  const hits: Hit[] = []

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const name = `${mat?.name ?? ''} ${mesh.name ?? ''}`
    if (!/hide/i.test(name)) return
    const pos = mesh.geometry.attributes.position
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(_rootInv)
      hits.push({ mesh, i, x: _v.x, y: _v.y, z: _v.z })
    }
  })
  if (!hits.length) return

  let minY = Infinity
  let maxY = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  for (const h of hits) {
    if (h.y < minY) minY = h.y
    if (h.y > maxY) maxY = h.y
    if (h.z < minZ) minZ = h.z
    if (h.z > maxZ) maxZ = h.z
  }
  const yCut = minY + (maxY - minY) * 0.5
  const zFore = minZ + (maxZ - minZ) * 0.58
  const zHind = minZ + (maxZ - minZ) * 0.42
  const xAbs = 0.05

  const byGeom = new Map<THREE.BufferGeometry, { id: Float32Array; pivot: Float32Array; along: Float32Array }>()
  const hips = {
    1: { x: 0, y: 0, z: 0, n: 0 },
    2: { x: 0, y: 0, z: 0, n: 0 },
    3: { x: 0, y: 0, z: 0, n: 0 },
    4: { x: 0, y: 0, z: 0, n: 0 },
  }
  const hoofs = {
    1: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    2: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    3: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    4: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
  }

  const tagged: { hit: Hit; id: number }[] = []
  for (const h of hits) {
    let id = 0
    if (h.y <= yCut && Math.abs(h.x) >= xAbs) {
      if (h.z >= zFore) id = h.x < 0 ? 1 : 2
      else if (h.z <= zHind) id = h.x < 0 ? 3 : 4
    }
    tagged.push({ hit: h, id })
    if (id === 0) continue
    const hip = hips[id as 1 | 2 | 3 | 4]
    const hoof = hoofs[id as 1 | 2 | 3 | 4]
    // Shoulder / hip = upper band of the leg cluster.
    if (h.y > yCut - (maxY - minY) * 0.12) {
      hip.x += h.x
      hip.y += h.y
      hip.z += h.z
      hip.n++
    }
    if (h.y < hoof.minY + 0.08) {
      if (h.y < hoof.minY) hoof.minY = h.y
      hoof.x += h.x
      hoof.y += h.y
      hoof.z += h.z
      hoof.n++
    }
  }

  for (const id of [1, 2, 3, 4] as const) {
    if (hips[id].n) {
      hips[id].x /= hips[id].n
      hips[id].y /= hips[id].n
      hips[id].z /= hips[id].n
    }
    if (hoofs[id].n) {
      hoofs[id].x /= hoofs[id].n
      hoofs[id].y /= hoofs[id].n
      hoofs[id].z /= hoofs[id].n
    }
  }

  for (const { hit, id } of tagged) {
    const geom = hit.mesh.geometry
    let bag = byGeom.get(geom)
    if (!bag) {
      const n = geom.attributes.position.count
      bag = {
        id: new Float32Array(n),
        pivot: new Float32Array(n * 3),
        along: new Float32Array(n),
      }
      byGeom.set(geom, bag)
    }
    bag.id[hit.i] = id
    if (id === 0) continue
    const hip = hips[id as 1 | 2 | 3 | 4]
    const hoof = hoofs[id as 1 | 2 | 3 | 4]
    _hip.set(hip.x, hip.y, hip.z)
    _hoof.set(hoof.x, hoof.y, hoof.z)
    _meshInv.copy(hit.mesh.matrixWorld).invert()
    // Hip in mesh-local (shader runs in object space).
    _tmp.copy(_hip).applyMatrix4(root.matrixWorld).applyMatrix4(_meshInv)
    bag.pivot[hit.i * 3] = _tmp.x
    bag.pivot[hit.i * 3 + 1] = _tmp.y
    bag.pivot[hit.i * 3 + 2] = _tmp.z
    const span = Math.max(0.001, hip.y - (hoof.n ? hoof.y : minY))
    bag.along[hit.i] = THREE.MathUtils.clamp((hip.y - hit.y) / span, 0, 1)
  }

  for (const [geom, bag] of byGeom) {
    if (geom.userData.tvGallop) continue
    geom.setAttribute('legId', new THREE.BufferAttribute(bag.id, 1))
    geom.setAttribute('legPivot', new THREE.BufferAttribute(bag.pivot, 3))
    geom.setAttribute('legAlong', new THREE.BufferAttribute(bag.along, 1))
    geom.userData.tvGallop = true
  }
}

function bindGallopMaterials(root: THREE.Object3D): GallopRig {
  const existing = root.userData.gallop as GallopRig | undefined
  if (existing) return existing
  const rig: GallopRig = {
    swing: new THREE.Vector4(),
    knee: new THREE.Vector4(),
  }
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of mats) {
      const mat = m as THREE.MeshStandardMaterial
      if (!mat || mat.userData.tvGallopShader) continue
      mat.userData.tvGallopShader = true
      mat.customProgramCacheKey = () => 'tv-gallop-v1'
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uLegSwing = { value: rig.swing }
        shader.uniforms.uLegKnee = { value: rig.knee }
        shader.vertexShader = shader.vertexShader
          .replace(
            '#include <common>',
            `#include <common>
attribute float legId;
attribute vec3 legPivot;
attribute float legAlong;
uniform vec4 uLegSwing;
uniform vec4 uLegKnee;
void tvRx(inout vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  float y = p.y;
  float z = p.z;
  p.y = c * y - s * z;
  p.z = s * y + c * z;
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
  tvRx(p, swing);
  if (legAlong > 0.42) {
    vec3 k = vec3(0.0, -0.38, 0.0);
    vec3 q = p - k;
    tvRx(q, knee);
    p = q + k;
  }
  transformed = p + legPivot;
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
  if (legAlong > 0.42) tvRx(objectNormal, knee);
#ifdef USE_TANGENT
  tvRx(objectTangent, swing);
  if (legAlong > 0.42) tvRx(objectTangent, knee);
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
      // Coat lerp is hide only — saddle/bit stay GLB materials.
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

function applyGallop(rig: GallopRig | undefined, g: number, racing: boolean) {
  if (!rig) return
  if (!racing) {
    rig.swing.set(0, 0, 0, 0)
    rig.knee.set(0, 0, 0, 0)
    return
  }
  // Transverse gallop (left lead): hind left → hind right → fore left → fore right.
  const hl = Math.sin(g)
  const hr = Math.sin(g + 0.55)
  const fl = Math.sin(g + Math.PI + 0.25)
  const fr = Math.sin(g + Math.PI + 0.85)
  rig.swing.set(fl * 0.62, fr * 0.62, hl * 0.72, hr * 0.72)
  rig.knee.set(
    0.25 + Math.max(0, -fl) * 0.95,
    0.25 + Math.max(0, -fr) * 0.95,
    0.35 + Math.max(0, -hl) * 0.85,
    0.35 + Math.max(0, -hr) * 0.85,
  )
}

export function Thoroughbred({ horse, index, fieldRef }: Props) {
  const root = useRef<THREE.Group>(null)
  const jockey = useRef<THREE.Group>(null)
  const gait = useRef(Math.random() * Math.PI * 2)
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
    // Group +Z = travel. GLB head is already +Z — do not yaw the mesh 180.
    root.current.rotation.y = Math.atan2(tan.x, tan.z)

    const rig = inst.userData.gallop as GallopRig | undefined
    if (s.pace <= 0.08) {
      applyGallop(rig, 0, false)
      root.current.rotation.x = 0
      root.current.rotation.z = 0
      if (jockey.current) {
        jockey.current.position.set(0, 1.08, -0.08)
        jockey.current.rotation.x = 0.72
      }
      return
    }

    const strideHz = 2.4 + s.pace * 1.7
    gait.current += dt * strideHz * Math.PI * 2
    const g = gait.current
    applyGallop(rig, g, true)
    const bob = Math.sin(g * 2) * 0.07
    const gather = Math.max(0, -Math.sin(g * 2)) * 0.04
    root.current.position.y = bob
    root.current.rotation.z = Math.sin(g) * 0.04
    root.current.rotation.x = Math.sin(g * 2) * 0.05
    if (jockey.current) {
      jockey.current.position.set(0, 1.08 + bob * 0.35 + gather, -0.08)
      jockey.current.rotation.x = 0.72 + Math.sin(g * 2) * 0.08
    }
  })

  return (
    <group ref={root} frustumCulled={false}>
      <primitive object={inst} rotation={[0, 0, 0]} scale={0.52} />
      <mesh castShadow position={[0, 0.92, -0.04]} rotation={[0, 0, 0]}>
        <boxGeometry args={[0.42, 0.05, 0.36]} />
        <meshStandardMaterial color={horse.jersey} roughness={0.5} metalness={0.08} />
      </mesh>
      <group ref={jockey} position={[0, 1.08, -0.08]} rotation={[0.72, 0, 0]}>
        <mesh castShadow position={[0, 0.12, 0.02]} rotation={[0.2, 0, 0]}>
          <capsuleGeometry args={[0.07, 0.14, 5, 8]} />
          <meshStandardMaterial color={horse.jersey} roughness={0.45} metalness={0.12} />
        </mesh>
        <mesh castShadow position={[0, 0.28, 0.12]}>
          <sphereGeometry args={[0.075, 12, 10]} />
          <meshStandardMaterial color={horse.jersey} roughness={0.38} metalness={0.16} />
        </mesh>
        <mesh position={[0, 0.26, 0.14]}>
          <sphereGeometry args={[0.048, 8, 8]} />
          <meshStandardMaterial color="#e0b090" roughness={0.65} />
        </mesh>
        <mesh castShadow position={[-0.1, 0.14, 0.16]} rotation={[1.05, 0.4, 0.15]}>
          <capsuleGeometry args={[0.024, 0.2, 3, 6]} />
          <meshStandardMaterial color={horse.jersey} />
        </mesh>
        <mesh castShadow position={[0.1, 0.14, 0.16]} rotation={[1.05, -0.4, -0.15]}>
          <capsuleGeometry args={[0.024, 0.2, 3, 6]} />
          <meshStandardMaterial color={horse.jersey} />
        </mesh>
        <mesh castShadow position={[0, 0.0, -0.02]}>
          <boxGeometry args={[0.16, 0.08, 0.12]} />
          <meshStandardMaterial color="#f3eee6" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[-0.06, -0.1, 0.05]} rotation={[1.0, 0, 0]}>
          <capsuleGeometry args={[0.024, 0.14, 3, 6]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
        <mesh castShadow position={[0.06, -0.1, 0.05]} rotation={[1.0, 0, 0]}>
          <capsuleGeometry args={[0.024, 0.14, 3, 6]} />
          <meshStandardMaterial color="#1a1410" />
        </mesh>
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

useGLTF.preload(HORSE_URL)
