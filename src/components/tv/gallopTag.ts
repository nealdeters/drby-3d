import * as THREE from 'three'

const _rootInv = new THREE.Matrix4()
const _meshInv = new THREE.Matrix4()
const _v = new THREE.Vector3()
const _hip = new THREE.Vector3()
const _hoof = new THREE.Vector3()
const _tmp = new THREE.Vector3()

type Hit = { mesh: THREE.Mesh; i: number; x: number; y: number; z: number }

type Acc = { x: number; y: number; z: number; n: number }

function skipCoatMesh(matName: string, metalness: number | undefined): boolean {
  if (/timber|metal|leather/i.test(matName)) return true
  if (typeof metalness === 'number' && metalness > 0.4) return true
  return false
}

/**
 * Tag limb vertices into FL/FR/HL/HR (legId 1–4) plus neck/head/tail (partId 5–7).
 *
 * The standing riding-horse GLB has no clips. Previous tagging only accepted
 * /hide/ verts below mid-height AND outside a 42–58% Z dead zone. On this mesh
 * the fore cannons sit in that dead zone (~z=0), so FL/FR got ~0 verts and
 * stayed in the rest pose — two carousel poles under a waving pair of hinds.
 *
 * Fix: cluster ALL coat geometry below the barrel by x-sign × z-fore/hind,
 * seeded from hoof k-means. No Z dead zone.
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
  const maxR = 0.24
  const maxR2 = maxR * maxR

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
      // Prefer xz proximity to a hoof; also take obvious side-cannons (|x| large, low).
      const yCannon = minY + ySpan * 0.38
      if (bd <= maxR2 || (Math.abs(h.x) >= 0.08 && h.y <= yCannon)) {
        id = seedLeg[bi]
      }
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
    if (h.y > yBarrel - ySpan * 0.14) {
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
    { id: Float32Array; pivot: Float32Array; along: Float32Array; part: Float32Array; partPivot: Float32Array }
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
      _meshInv.copy(hit.mesh.matrixWorld).invert()
      _tmp.copy(_hip).applyMatrix4(root.matrixWorld).applyMatrix4(_meshInv)
      bag.pivot[hit.i * 3] = _tmp.x
      bag.pivot[hit.i * 3 + 1] = _tmp.y
      bag.pivot[hit.i * 3 + 2] = _tmp.z
      const span = Math.max(0.001, hip.y - (hoof.n ? hoof.y : minY))
      bag.along[hit.i] = THREE.MathUtils.clamp((hip.y - hit.y) / span, 0, 1)
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
    geom.setAttribute('partId', new THREE.BufferAttribute(bag.part, 1))
    geom.setAttribute('partPivot', new THREE.BufferAttribute(bag.partPivot, 3))
    geom.userData.tvGallop = 'v4'
  }
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
