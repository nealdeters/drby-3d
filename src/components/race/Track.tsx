import { useMemo } from 'react'
import * as THREE from 'three'
import { TRACK, ovalPoint } from './trackMath'

const DIRT = '#d2b48c'
const DIRT_DARK = '#c4a574'
const RAIL = '#f5f5f0'
const TURF = '#3d8f3a'
const TURF_DEEP = '#2f7a32'
const CREAM = '#f3eee3'
const STONE = '#e8e0d0'
const COLUMN = '#f8f4ec'
const NAVY = '#1a2744'
const GOLD = '#c9a227'
const HEDGE = '#2d6b2e'
const FLOWER_PINK = '#e89ab0'
const FLOWER_RED = '#c44536'
const FLOWER_YELLOW = '#e8c97a'

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
    indices.push(a, c, b, b, c, d)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

function RailPosts({
  rx,
  rz,
  y = 0.38,
  count = 48,
}: {
  rx: number
  rz: number
  y?: number
  count?: number
}) {
  const posts = useMemo(() => {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i < count; i++) {
      pts.push(ovalPoint(i / count, rx, rz))
    }
    return pts
  }, [rx, rz, count])

  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, y, p.z]} castShadow>
          <cylinderGeometry args={[0.055, 0.065, 0.76, 6]} />
          <meshStandardMaterial color={RAIL} metalness={0.15} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function TwinSpire({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 5.2, 0]} castShadow>
        <boxGeometry args={[1.35, 10.4, 1.35]} />
        <meshStandardMaterial color={CREAM} roughness={0.72} />
      </mesh>
      <mesh position={[0, 7.6, 0]}>
        <boxGeometry args={[1.55, 0.35, 1.55]} />
        <meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, 11.4, 0]} castShadow>
        <coneGeometry args={[0.95, 2.8, 8]} />
        <meshStandardMaterial color={NAVY} roughness={0.55} />
      </mesh>
      <mesh position={[0, 12.95, 0]}>
        <sphereGeometry args={[0.18, 10, 10]} />
        <meshStandardMaterial color={GOLD} metalness={0.65} roughness={0.25} />
      </mesh>
      {[
        [-0.55, -0.55],
        [0.55, -0.55],
        [-0.55, 0.55],
        [0.55, 0.55],
      ].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 10.55, dz]}>
          <coneGeometry args={[0.12, 0.55, 5]} />
          <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

function CrowdDots({
  width,
  depth,
  rows,
  cols,
  baseY,
  baseZ,
}: {
  width: number
  depth: number
  rows: number
  cols: number
  baseY: number
  baseZ: number
}) {
  const dots = useMemo(() => {
    const colors = [
      '#c44536',
      '#1a4a8a',
      '#f5f0e6',
      '#2a6b3a',
      '#8b1a4a',
      '#e8c97a',
      '#3a2818',
      '#4a6fa5',
      '#d4782a',
      '#5c4033',
    ]
    const items: { x: number; y: number; z: number; c: string; s: number }[] = []
    // Deterministic pseudo-random so remounts stay stable
    let seed = 17
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rand() > 0.72) continue
        const x = (c / Math.max(cols - 1, 1) - 0.5) * width + (rand() - 0.5) * 0.35
        const z = baseZ + (r / Math.max(rows - 1, 1)) * depth + (rand() - 0.5) * 0.2
        const y = baseY + r * 0.52 + 0.35
        items.push({
          x,
          y,
          z,
          c: colors[(r * cols + c) % colors.length],
          s: 0.14 + rand() * 0.08,
        })
      }
    }
    return items
  }, [width, depth, rows, cols, baseY, baseZ])

  return (
    <group>
      {dots.map((d, i) => (
        <mesh key={i} position={[d.x, d.y, d.z]}>
          <sphereGeometry args={[d.s, 5, 5]} />
          <meshStandardMaterial color={d.c} roughness={0.85} />
        </mesh>
      ))}
    </group>
  )
}

function HedgeBox({
  position,
  size,
}: {
  position: [number, number, number]
  size: [number, number, number]
}) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={HEDGE} roughness={0.95} />
    </mesh>
  )
}

function FlowerBed({ position, width }: { position: [number, number, number]; width: number }) {
  const blooms = useMemo(() => {
    const cols = [FLOWER_PINK, FLOWER_RED, FLOWER_YELLOW, '#f0e6d2']
    const n = Math.max(6, Math.floor(width / 0.55))
    return Array.from({ length: n }, (_, i) => ({
      x: (i / Math.max(n - 1, 1) - 0.5) * width * 0.9,
      c: cols[i % cols.length],
    }))
  }, [width])

  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[width, 0.24, 0.55]} />
        <meshStandardMaterial color="#5a4030" roughness={1} />
      </mesh>
      {blooms.map((b, i) => (
        <mesh key={i} position={[b.x, 0.32, (i % 2) * 0.12 - 0.06]}>
          <sphereGeometry args={[0.1, 5, 5]} />
          <meshStandardMaterial color={b.c} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export function Track() {
  const dirtGeo = useMemo(
    () => ringGeometry(TRACK.innerRx, TRACK.innerRz, TRACK.outerRx, TRACK.outerRz, 112),
    [],
  )
  const wearGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.centerRx - 1.1,
        TRACK.centerRz - 0.7,
        TRACK.centerRx + 1.1,
        TRACK.centerRz + 0.7,
        80,
      ),
    [],
  )
  const outerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.outerRx - 0.12,
        TRACK.outerRz - 0.1,
        TRACK.outerRx + 0.42,
        TRACK.outerRz + 0.32,
        96,
      ),
    [],
  )
  const innerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.innerRx - 0.42,
        TRACK.innerRz - 0.32,
        TRACK.innerRx + 0.12,
        TRACK.innerRz + 0.1,
        96,
      ),
    [],
  )
  const infieldGeo = useMemo(
    () => ringGeometry(0.05, 0.05, TRACK.innerRx - 0.55, TRACK.innerRz - 0.45, 64),
    [],
  )

  const finish = useMemo(() => ovalPoint(0.5, TRACK.centerRx, TRACK.centerRz), [])
  const finishInner = useMemo(() => ovalPoint(0.5, TRACK.innerRx + 0.3, TRACK.innerRz + 0.2), [])
  const finishOuter = useMemo(() => ovalPoint(0.5, TRACK.outerRx - 0.3, TRACK.outerRz - 0.2), [])
  const gateSpan = Math.hypot(finishOuter.x - finishInner.x, finishOuter.z - finishInner.z)

  return (
    <group>
      {/* Outer grounds — bright lawn apron */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[140, 110]} />
        <meshStandardMaterial color="#4a9a45" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <ringGeometry args={[26, 34, 64]} />
        <meshStandardMaterial color="#3f8a3c" roughness={1} />
      </mesh>

      {/* Sandy / tan dirt racing surface */}
      <mesh geometry={dirtGeo} receiveShadow>
        <meshStandardMaterial color={DIRT} roughness={0.98} />
      </mesh>
      <mesh geometry={wearGeo} position={[0, 0.005, 0]} receiveShadow>
        <meshStandardMaterial color={DIRT_DARK} roughness={1} transparent opacity={0.45} />
      </mesh>

      {/* Crisp white rails */}
      <mesh geometry={outerRailGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={RAIL} metalness={0.2} roughness={0.3} />
      </mesh>
      <mesh geometry={innerRailGeo} position={[0, 0.05, 0]}>
        <meshStandardMaterial color={RAIL} metalness={0.2} roughness={0.3} />
      </mesh>
      <RailPosts rx={TRACK.outerRx + 0.12} rz={TRACK.outerRz + 0.1} count={60} />
      <RailPosts rx={TRACK.innerRx - 0.12} rz={TRACK.innerRz - 0.1} count={44} />

      {/* Bright manicured infield turf */}
      <mesh geometry={infieldGeo} position={[0, 0.015, 0]} receiveShadow>
        <meshStandardMaterial color={TURF} roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.5, 40]} />
        <meshStandardMaterial color={TURF_DEEP} roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[4.2, 5.2, 40]} />
        <meshStandardMaterial color={HEDGE} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[2.0, 2.25, 0.2, 28]} />
        <meshStandardMaterial color={STONE} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.24, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.55, 28]} />
        <meshStandardMaterial color={GOLD} metalness={0.45} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.15, 1.45, 28]} />
        <meshStandardMaterial color={NAVY} roughness={0.5} />
      </mesh>

      {/* Finish stripe + gate */}
      <group>
        <mesh position={[finish.x, 0.035, finish.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.55, gateSpan]} />
          <meshStandardMaterial color="#ffffff" roughness={0.75} />
        </mesh>
        <mesh position={[finishInner.x, 0.95, finishInner.z]} castShadow>
          <boxGeometry args={[0.2, 1.9, 0.2]} />
          <meshStandardMaterial color={CREAM} metalness={0.15} roughness={0.4} />
        </mesh>
        <mesh position={[finishOuter.x, 0.95, finishOuter.z]} castShadow>
          <boxGeometry args={[0.2, 1.9, 0.2]} />
          <meshStandardMaterial color={CREAM} metalness={0.15} roughness={0.4} />
        </mesh>
        <mesh position={[finish.x, 1.85, finish.z]} castShadow>
          <boxGeometry args={[0.14, 0.14, gateSpan]} />
          <meshStandardMaterial color={NAVY} metalness={0.2} roughness={0.45} />
        </mesh>
      </group>

      {/* Twin Spires landmark */}
      <TwinSpire x={-3.2} z={-19.2} />
      <TwinSpire x={3.2} z={-19.2} />
      <mesh position={[0, 2.4, -19.0]} castShadow receiveShadow>
        <boxGeometry args={[18, 4.8, 2.2]} />
        <meshStandardMaterial color={CREAM} roughness={0.7} />
      </mesh>
      <mesh position={[0, 5.0, -19.0]}>
        <boxGeometry args={[19.5, 0.45, 2.8]} />
        <meshStandardMaterial color={STONE} roughness={0.65} />
      </mesh>
      {[-6, -3, 0, 3, 6].map((x) => (
        <mesh key={x} position={[x, 2.6, -17.85]}>
          <boxGeometry args={[1.4, 1.6, 0.12]} />
          <meshStandardMaterial color="#7eb6e8" metalness={0.3} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 4.2, -17.7]}>
        <boxGeometry args={[17, 0.12, 0.12]} />
        <meshStandardMaterial color={GOLD} metalness={0.5} roughness={0.3} />
      </mesh>

      {/* Near grandstand — cream / white with columns */}
      <group position={[0, 0, 21.2]}>
        {[0, 1, 2, 3, 4, 5, 6].map((row) => (
          <mesh key={row} position={[0, 0.35 + row * 0.5, row * 0.62]} castShadow receiveShadow>
            <boxGeometry args={[36 - row * 0.6, 0.28, 0.85]} />
            <meshStandardMaterial color={row % 2 ? STONE : CREAM} roughness={0.75} />
          </mesh>
        ))}
        <CrowdDots width={32} depth={3.8} rows={6} cols={28} baseY={0.35} baseZ={0.15} />
        {[-15, -10, -5, 0, 5, 10, 15].map((x) => (
          <group key={x} position={[x, 0, 1.2]}>
            <mesh position={[0, 2.35, 0]} castShadow>
              <cylinderGeometry args={[0.28, 0.32, 4.7, 10]} />
              <meshStandardMaterial color={COLUMN} roughness={0.55} />
            </mesh>
            <mesh position={[0, 4.85, 0]}>
              <boxGeometry args={[0.7, 0.28, 0.7]} />
              <meshStandardMaterial color={STONE} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.65, 0.24, 0.65]} />
              <meshStandardMaterial color={STONE} roughness={0.65} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 5.5, 2.4]} castShadow>
          <boxGeometry args={[38, 0.28, 8.5]} />
          <meshStandardMaterial color={NAVY} roughness={0.55} />
        </mesh>
        <mesh position={[0, 5.2, -0.9]}>
          <boxGeometry args={[37.5, 0.35, 0.25]} />
          <meshStandardMaterial color={GOLD} metalness={0.45} roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.6, 5.4]} castShadow>
          <boxGeometry args={[37, 5.2, 0.5]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>
      </group>

      <FlowerBed position={[-10, 0, 17.2]} width={8} />
      <FlowerBed position={[10, 0, 17.2]} width={8} />
      <FlowerBed position={[0, 0, 17.2]} width={6} />

      <HedgeBox position={[-8, 0.35, 0]} size={[1.2, 0.7, 3.5]} />
      <HedgeBox position={[8, 0.35, 0]} size={[1.2, 0.7, 3.5]} />
      <HedgeBox position={[0, 0.3, 4.5]} size={[4, 0.6, 0.8]} />
      <HedgeBox position={[0, 0.3, -4.5]} size={[4, 0.6, 0.8]} />

      <mesh position={[-28, 1.4, 0]} castShadow>
        <boxGeometry args={[3.5, 2.8, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.7} />
      </mesh>
      <mesh position={[-28, 2.95, 0]}>
        <boxGeometry args={[3.8, 0.3, 8.4]} />
        <meshStandardMaterial color={NAVY} roughness={0.5} />
      </mesh>
      <mesh position={[28, 1.4, 0]} castShadow>
        <boxGeometry args={[3.5, 2.8, 8]} />
        <meshStandardMaterial color={CREAM} roughness={0.7} />
      </mesh>
      <mesh position={[28, 2.95, 0]}>
        <boxGeometry args={[3.8, 0.3, 8.4]} />
        <meshStandardMaterial color={NAVY} roughness={0.5} />
      </mesh>
    </group>
  )
}
