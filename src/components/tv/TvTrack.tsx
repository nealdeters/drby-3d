import { useMemo } from 'react'
import * as THREE from 'three'
import { TRACK, ovalPoint } from '../race/trackMath'

/** Churchill dirt from stretch stills (center sample ~#A08866). */
const DIRT = '#d1b288'
const DIRT_CUP = '#b59d81'
const DIRT_WET = '#a08866'
const RAIL = '#f4f1ea'
const POST = '#e8e4da'
const TURF = '#4a7a38'
const TURF_DEEP = '#3a682c'
const CREAM = '#e8dcc8'
const BRICK = '#c4b49a'
const ROOF = '#3a322c'
const SPIRE = '#d9cbb6'

function ringGeometry(
  innerRx: number,
  innerRz: number,
  outerRx: number,
  outerRz: number,
  segments = 96,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2
    const ox = Math.sin(t) * outerRx
    const oz = -Math.cos(t) * outerRz
    const ix = Math.sin(t) * innerRx
    const iz = -Math.cos(t) * innerRz
    positions.push(ox, 0, oz, ix, 0, iz)
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, b, c, b, d, c)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function dirtTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = DIRT
  ctx.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 2400; i++) {
    const x = Math.random() * 512
    const y = Math.random() * 512
    const s = 1 + Math.random() * 3
    ctx.fillStyle = Math.random() > 0.5 ? DIRT_CUP : DIRT_WET
    ctx.globalAlpha = 0.18 + Math.random() * 0.25
    ctx.fillRect(x, y, s, s * 0.6)
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(8, 5)
  tex.anisotropy = 8
  return tex
}

function TwinSpire({ x }: { x: number }) {
  // Octagonal cream towers with dark roofs — clubhouse / stretch side (+Z).
  return (
    <group position={[x, 0, 22.6]}>
      <mesh position={[0, 6.2, 0]} castShadow>
        <cylinderGeometry args={[1.15, 1.35, 12.4, 8]} />
        <meshStandardMaterial color={SPIRE} roughness={0.78} />
      </mesh>
      <mesh position={[0, 12.55, 0]}>
        <cylinderGeometry args={[1.45, 1.45, 0.35, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.65} />
      </mesh>
      <mesh position={[0, 14.4, 0]} castShadow>
        <coneGeometry args={[1.55, 3.4, 8]} />
        <meshStandardMaterial color={ROOF} roughness={0.55} />
      </mesh>
      <mesh position={[0, 16.25, 0]}>
        <sphereGeometry args={[0.16, 10, 8]} />
        <meshStandardMaterial color="#c9a227" metalness={0.55} roughness={0.3} />
      </mesh>
    </group>
  )
}

export function TvTrack() {
  const dirtGeo = useMemo(
    () => ringGeometry(TRACK.innerRx, TRACK.innerRz, TRACK.outerRx, TRACK.outerRz, 128),
    [],
  )
  const wearGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.centerRx - 1.2,
        TRACK.centerRz - 0.75,
        TRACK.centerRx + 1.2,
        TRACK.centerRz + 0.75,
        80,
      ),
    [],
  )
  const outerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.outerRx - 0.1,
        TRACK.outerRz - 0.08,
        TRACK.outerRx + 0.38,
        TRACK.outerRz + 0.28,
        96,
      ),
    [],
  )
  const innerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.innerRx - 0.38,
        TRACK.innerRz - 0.28,
        TRACK.innerRx + 0.1,
        TRACK.innerRz + 0.08,
        96,
      ),
    [],
  )
  const tex = useMemo(() => dirtTexture(), [])
  const posts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 64; i++) pts.push(ovalPoint(i / 64, TRACK.outerRx + 0.1, TRACK.outerRz + 0.08))
    return pts
  }, [])
  const innerPosts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < 48; i++) pts.push(ovalPoint(i / 48, TRACK.innerRx - 0.1, TRACK.innerRz - 0.08))
    return pts
  }, [])

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
        <planeGeometry args={[180, 140]} />
        <meshStandardMaterial color={TURF} roughness={1} />
      </mesh>
      <mesh geometry={dirtGeo} position={[0, 0.03, 0]} receiveShadow>
        <meshStandardMaterial map={tex} color={DIRT} roughness={0.96} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={wearGeo} position={[0, 0.038, 0]} receiveShadow>
        <meshStandardMaterial color={DIRT_CUP} roughness={1} transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={outerRailGeo} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={RAIL} roughness={0.32} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={innerRailGeo} position={[0, 0.1, 0]}>
        <meshStandardMaterial color={RAIL} roughness={0.32} metalness={0.12} side={THREE.DoubleSide} />
      </mesh>
      {posts.map((p, i) => (
        <mesh key={`o${i}`} position={[p.x, 0.42, p.z]} castShadow>
          <cylinderGeometry args={[0.05, 0.055, 0.7, 6]} />
          <meshStandardMaterial color={POST} roughness={0.4} />
        </mesh>
      ))}
      {innerPosts.map((p, i) => (
        <mesh key={`i${i}`} position={[p.x, 0.42, p.z]} castShadow>
          <cylinderGeometry args={[0.045, 0.05, 0.7, 6]} />
          <meshStandardMaterial color={POST} roughness={0.4} />
        </mesh>
      ))}

      {/* Infield */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[TRACK.innerRz + 2.5, 48]} />
        <meshStandardMaterial color={TURF_DEEP} roughness={0.92} />
      </mesh>

      {/* Finish wire on near stretch */}
      {[-1.8, 1.8].map((x) => (
        <mesh key={x} position={[x, 1.15, TRACK.outerRz + 0.2]} castShadow>
          <cylinderGeometry args={[0.07, 0.09, 2.3, 8]} />
          <meshStandardMaterial color={RAIL} />
        </mesh>
      ))}
      <mesh position={[0, 2.25, TRACK.outerRz + 0.2]}>
        <boxGeometry args={[3.8, 0.06, 0.06]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      {/* Clubhouse + Twin Spires behind the stretch (NBC establishing) */}
      <TwinSpire x={-3.4} />
      <TwinSpire x={3.4} />
      <mesh position={[0, 4.6, 22.2]} castShadow>
        <boxGeometry args={[22, 9.2, 3.6]} />
        <meshStandardMaterial color={BRICK} roughness={0.82} />
      </mesh>
      <mesh position={[0, 9.4, 22.2]}>
        <boxGeometry args={[23.2, 0.5, 4.2]} />
        <meshStandardMaterial color={CREAM} roughness={0.7} />
      </mesh>
      {[-8, -4, 0, 4, 8].map((x) => (
        <mesh key={x} position={[x, 5.4, 20.35]}>
          <boxGeometry args={[2.2, 2.6, 0.12]} />
          <meshStandardMaterial color="#7ea8c8" metalness={0.25} roughness={0.3} />
        </mesh>
      ))}

      {/* Grandstand mass along +Z, set back from outer rail */}
      <group position={[0, 0, 19.4]}>
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <mesh key={row} position={[0, 0.4 + row * 0.55, row * 0.48]} castShadow receiveShadow>
            <boxGeometry args={[42 - row * 0.4, 0.28, 0.85]} />
            <meshStandardMaterial color={row % 2 ? '#8a6a4a' : '#b08a62'} roughness={0.84} />
          </mesh>
        ))}
        <mesh position={[0, 5.4, 2.2]} castShadow>
          <boxGeometry args={[40, 0.18, 6]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>
      </group>
    </group>
  )
}
