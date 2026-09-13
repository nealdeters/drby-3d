import * as THREE from 'three'

const _rootInv = new THREE.Matrix4()
const _meshInv = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _hip = new THREE.Vector3()
const _hoof = new THREE.Vector3()
const _knee = new THREE.Vector3()
const _tmp = new THREE.Vector3()
const _bone = new THREE.Vector3()

type Hit = { mesh: THREE.Mesh; i: number; x: number; y: number; z: number }

type Acc = { x: number; y: number; z: number; n: number }

/** Fraction of hip→hoof where the carpus / hock hinge sits. Must match the shader. */
export const KNEE_ALONG = 0.42

function skipCoatMesh(matName: string, metalness: number | undefined): boolean {
  if (/timber|metal|leather/i.test(matName)) return true
  if (typeof metalness === 'number' && metalness > 0.4) return true
  return false
}

export type LimbBox = {
  id: 1 | 2 | 3 | 4
  n: number
  min: [number, number, number]
  max: [number, number, number]
  centroid: [number, number, number]
  xSpan: number
  ySpan: number
  zSpan: number
}

/**
 * Tag limb vertices into FL/FR/HL/HR (legId 1–4) plus neck/head/tail (partId 5–7).
 *
 * Standing riding-horse GLB has no clips. Cluster coat verts into **thin limb
 * columns** around hoof k-means seeds (tight xz radius + z-fore/hind band) so
 * the shader rotates hip–knee–hoof cannons, not the chest/shoulder mass.
 */
export function ensureGallopAttributes(root: THREE.Object3D) {
  root.updateMatrixWorld(true)
  _rootInv.copy(root.matrixWorld).invert()

  const hits: Hit[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    const matName = mat?.name ?? ''
    if (skipCoatMesh(matName, mat?.metalness)) return
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
  const ySpan = Math.max(1e-6, maxY - minY)
  const zSpan = Math.max(1e-6, maxZ - minZ)
  const yBarrel = minY + ySpan * 0.48
  const yHoofCut = minY + ySpan * 0.14

  const hoofHits = hits.filter((h) => h.y <= yHoofCut && Math.abs(h.x) >= 0.03)
  let hminX = Infinity
  let hmaxX = -Infinity
  let hminZ = Infinity
  let hmaxZ = -Infinity
  for (const h of hoofHits) {
    if (h.x < hminX) hminX = h.x
    if (h.x > hmaxX) hmaxX = h.x
    if (h.z < hminZ) hminZ = h.z
    if (h.z > hmaxZ) hmaxZ = h.z
  }
  if (!hoofHits.length) {
    hminX = -0.2
    hmaxX = 0.2
    hminZ = minZ
    hmaxZ = maxZ
  }

  // Four corner seeds: left/right × fore/hind of the hoof cloud.
  const seeds = [
    { x: hminX, z: hmaxZ },
    { x: hmaxX, z: hmaxZ },
    { x: hminX, z: hminZ },
    { x: hmaxX, z: hminZ },
  ]
  const cloud = hoofHits.length ? hoofHits : hits.filter((h) => h.y <= yBarrel && Math.abs(h.x) >= 0.05)
  for (let iter = 0; iter < 14; iter++) {
    const acc = [
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
      { x: 0, z: 0, n: 0 },
    ]
    for (const h of cloud) {
      let bi = 0
      let bd = Infinity
      for (let k = 0; k < 4; k++) {
        const dx = h.x - seeds[k].x
        const dz = h.z - seeds[k].z
        const d = dx * dx + dz * dz
        if (d < bd) {
          bd = d
          bi = k
        }
      }
      acc[bi].x += h.x
      acc[bi].z += h.z
      acc[bi].n++
    }
    for (let k = 0; k < 4; k++) {
      if (acc[k].n) {
        seeds[k].x = acc[k].x / acc[k].n
        seeds[k].z = acc[k].z / acc[k].n
      }
    }
  }

  const byZ = [...seeds].sort((a, b) => b.z - a.z)
  const splitZ = (byZ[1].z + byZ[2].z) / 2
  const seedLeg: (1 | 2 | 3 | 4)[] = seeds.map((c) => {
    const fore = c.z >= splitZ
    if (c.x < 0) return fore ? 1 : 3
    return fore ? 2 : 4
  })
  // If two seeds collapsed onto one quadrant, force unique FL/FR/HL/HR by rank.
  if (new Set(seedLeg).size < 4) {
    const ranked = seeds.map((c, i) => ({ i, ...c })).sort((a, b) => b.z - a.z)
    const fore = ranked.slice(0, 2)
    const hind = ranked.slice(2, 4)
    for (const s of fore) seedLeg[s.i] = s.x < 0 ? 1 : 2
    for (const s of hind) seedLeg[s.i] = s.x < 0 ? 3 : 4
  }

  const hips: Record<1 | 2 | 3 | 4, Acc> = {
    1: { x: 0, y: 0, z: 0, n: 0 },
    2: { x: 0, y: 0, z: 0, n: 0 },
    3: { x: 0, y: 0, z: 0, n: 0 },
    4: { x: 0, y: 0, z: 0, n: 0 },
  }
  const hoofs: Record<1 | 2 | 3 | 4, Acc & { minY: number }> = {
    1: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    2: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    3: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
    4: { x: 0, y: 0, z: 0, n: 0, minY: Infinity },
  }
  const parts: Record<5 | 6 | 7, Acc> = {
    5: { x: 0, y: 0, z: 0, n: 0 },
    6: { x: 0, y: 0, z: 0, n: 0 },
    7: { x: 0, y: 0, z: 0, n: 0 },
  }

  const tagged: { hit: Hit; id: number; part: number }[] = []
  // Cannon-thin column: hoof-seed cylinder, not a chest-width flood.
  const maxR = 0.078
  const maxR2 = maxR * maxR
  const maxDx = 0.08
  const maxDz = 0.085
  const yHipBand = yBarrel - ySpan * 0.1

  for (const h of hits) {
    let id = 0
    if (h.y <= yBarrel) {
      let bi = 0
      let bd = Infinity
      for (let k = 0; k < 4; k++) {
        const dx = h.x - seeds[k].x
        const dz = h.z - seeds[k].z
        const d = dx * dx + dz * dz
        if (d < bd) {
          bd = d
          bi = k
        }
      }
      const s = seeds[bi]
      const inCol =
        bd <= maxR2 && Math.abs(h.x - s.x) <= maxDx && Math.abs(h.z - s.z) <= maxDz
      if (inCol) id = seedLeg[bi]
    }

    let part = id
    if (id === 0) {
      if (h.z >= minZ + zSpan * 0.8 && h.y >= minY + ySpan * 0.35) part = 6
      else if (h.z >= minZ + zSpan * 0.58 && h.y >= minY + ySpan * 0.48) part = 5
      else if (h.z <= minZ + zSpan * 0.16 && Math.abs(h.x) < 0.12) part = 7
    }
    tagged.push({ hit: h, id, part })
    if (id === 0) {
      if (part === 5 || part === 6 || part === 7) {
        const bag = parts[part]
        bag.x += h.x
        bag.y += h.y
        bag.z += h.z
        bag.n++
      }
      continue
    }
    const hip = hips[id as 1 | 2 | 3 | 4]
    const hoof = hoofs[id as 1 | 2 | 3 | 4]
    if (h.y >= yHipBand) {
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
    } else {
      const s = seeds[seedLeg.indexOf(id)] ?? seeds[0]
      hips[id].x = s.x
      hips[id].y = yBarrel
      hips[id].z = s.z
    }
    if (hoofs[id].n) {
      hoofs[id].x /= hoofs[id].n
      hoofs[id].y /= hoofs[id].n
      hoofs[id].z /= hoofs[id].n
    } else {
      const s = seeds[seedLeg.indexOf(id)] ?? seeds[0]
      hoofs[id].x = s.x
      hoofs[id].y = minY
      hoofs[id].z = s.z
    }
  }
  for (const id of [5, 6, 7] as const) {
    if (parts[id].n) {
      parts[id].x /= parts[id].n
      parts[id].y /= parts[id].n
      parts[id].z /= parts[id].n
    }
  }

  const byGeom = new Map<
    THREE.BufferGeometry,
    {
      id: Float32Array
      pivot: Float32Array
      along: Float32Array
      knee: Float32Array
      part: Float32Array
      partPivot: Float32Array
    }
  >()

  for (const { hit, id, part } of tagged) {
    const geom = hit.mesh.geometry
    let bag = byGeom.get(geom)
    if (!bag) {
      const n = geom.attributes.position.count
      bag = {
        id: new Float32Array(n),
        pivot: new Float32Array(n * 3),
        along: new Float32Array(n),
        knee: new Float32Array(n * 3),
        part: new Float32Array(n),
        partPivot: new Float32Array(n * 3),
      }
      byGeom.set(geom, bag)
    }
    bag.id[hit.i] = id
    bag.part[hit.i] = part
    if (id !== 0) {
      const hip = hips[id as 1 | 2 | 3 | 4]
      const hoof = hoofs[id as 1 | 2 | 3 | 4]
      _hip.set(hip.x, hip.y, hip.z)
      _hoof.set(hoof.x, hoof.y, hoof.z)
      _knee.lerpVectors(_hip, _hoof, KNEE_ALONG)
      _meshInv.copy(hit.mesh.matrixWorld).invert()
      _tmp.copy(_hip).applyMatrix4(root.matrixWorld).applyMatrix4(_meshInv)
      bag.pivot[hit.i * 3] = _tmp.x
      bag.pivot[hit.i * 3 + 1] = _tmp.y
      bag.pivot[hit.i * 3 + 2] = _tmp.z
      _tmp.copy(_knee).applyMatrix4(root.matrixWorld).applyMatrix4(_meshInv)
      bag.knee[hit.i * 3] = _tmp.x
      bag.knee[hit.i * 3 + 1] = _tmp.y
      bag.knee[hit.i * 3 + 2] = _tmp.z
      _bone.subVectors(_hoof, _hip)
      const len2 = _bone.lengthSq()
      _tmp.set(hit.x, hit.y, hit.z).sub(_hip)
      bag.along[hit.i] = len2 <= 1e-8 ? 0 : THREE.MathUtils.clamp(_tmp.dot(_bone) / len2, 0, 1)
    } else if (part === 5 || part === 6 || part === 7) {
      const pv = parts[part]
      _meshInv.copy(hit.mesh.matrixWorld).invert()
      _tmp.set(pv.x, pv.y, pv.z).applyMatrix4(root.matrixWorld).applyMatrix4(_meshInv)
      bag.partPivot[hit.i * 3] = _tmp.x
      bag.partPivot[hit.i * 3 + 1] = _tmp.y
      bag.partPivot[hit.i * 3 + 2] = _tmp.z
    }
  }

  for (const [geom, bag] of byGeom) {
    geom.setAttribute('legId', new THREE.BufferAttribute(bag.id, 1))
    geom.setAttribute('legPivot', new THREE.BufferAttribute(bag.pivot, 3))
    geom.setAttribute('legAlong', new THREE.BufferAttribute(bag.along, 1))
    geom.setAttribute('legKnee', new THREE.BufferAttribute(bag.knee, 3))
    geom.setAttribute('partId', new THREE.BufferAttribute(bag.part, 1))
    geom.setAttribute('partPivot', new THREE.BufferAttribute(bag.partPivot, 3))
    geom.userData.tvGallop = 'v5'
  }

  root.userData.gallopLimbStats = measureGallopLimbs(root)
}

/** Count tagged verts after ensureGallopAttributes — diagnostic / tests. */
export function countGallopTags(root: THREE.Object3D): { legId: number[]; partId: number[] } {
  const legId = [0, 0, 0, 0, 0]
  const partId = [0, 0, 0, 0, 0, 0, 0, 0]
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const lids = mesh.geometry.getAttribute('legId')
    const pids = mesh.geometry.getAttribute('partId')
    if (!lids) return
    for (let i = 0; i < lids.count; i++) {
      const id = Math.round(lids.getX(i))
      if (id >= 0 && id <= 4) legId[id]++
      if (pids) {
        const p = Math.round(pids.getX(i))
        if (p >= 0 && p <= 7) partId[p]++
      }
    }
  })
  return { legId, partId }
}

/** Root-space AABBs of tagged cannons (legId 1–4). */
export function measureGallopLimbs(root: THREE.Object3D): LimbBox[] {
  root.updateMatrixWorld(true)
  _rootInv.copy(root.matrixWorld).invert()
  const acc: Record<1 | 2 | 3 | 4, { n: number; sx: number; sy: number; sz: number; min: number[]; max: number[] }> = {
    1: { n: 0, sx: 0, sy: 0, sz: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    2: { n: 0, sx: 0, sy: 0, sz: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    3: { n: 0, sx: 0, sy: 0, sz: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
    4: { n: 0, sx: 0, sy: 0, sz: 0, min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] },
  }
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    const lids = mesh.geometry.getAttribute('legId')
    const pos = mesh.geometry.attributes.position
    if (!lids || !pos) return
    for (let i = 0; i < lids.count; i++) {
      const raw = Math.round(lids.getX(i))
      if (raw !== 1 && raw !== 2 && raw !== 3 && raw !== 4) continue
      const id = raw
      _v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).applyMatrix4(_rootInv)
      const b = acc[id]
      b.n++
      b.sx += _v.x
      b.sy += _v.y
      b.sz += _v.z
      if (_v.x < b.min[0]) b.min[0] = _v.x
      if (_v.y < b.min[1]) b.min[1] = _v.y
      if (_v.z < b.min[2]) b.min[2] = _v.z
      if (_v.x > b.max[0]) b.max[0] = _v.x
      if (_v.y > b.max[1]) b.max[1] = _v.y
      if (_v.z > b.max[2]) b.max[2] = _v.z
    }
  })
  return ([1, 2, 3, 4] as const).map((id) => {
    const b = acc[id]
    const n = Math.max(1, b.n)
    return {
      id,
      n: b.n,
      min: [b.min[0], b.min[1], b.min[2]] as [number, number, number],
      max: [b.max[0], b.max[1], b.max[2]] as [number, number, number],
      centroid: [b.sx / n, b.sy / n, b.sz / n] as [number, number, number],
      xSpan: b.max[0] - b.min[0],
      ySpan: b.max[1] - b.min[1],
      zSpan: b.max[2] - b.min[2],
    }
  })
}
