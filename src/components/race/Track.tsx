import { useMemo } from 'react'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
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


function SignBoard({
  position,
  rotation = [0, 0, 0],
  width,
  height,
  label,
  sublabel,
  face = 'cream',
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  width: number
  height: number
  label: string
  sublabel?: string
  face?: 'cream' | 'green' | 'navy'
}) {
  const bg = face === 'cream' ? '#f7f2e6' : face === 'green' ? '#1e5c2a' : '#142038'
  const fg = face === 'cream' ? '#142038' : '#f7f2e6'
  const fontSize = Math.min(height * 0.42, width / Math.max(label.length * 0.55, 1))
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[width, height, 0.12]} />
        <meshStandardMaterial color={bg} roughness={0.55} />
      </mesh>
      {/* Navy / gold trim */}
      <mesh position={[0, height * 0.5 - 0.04, 0.02]}>
        <boxGeometry args={[width, 0.08, 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.35} />
      </mesh>
      <mesh position={[0, -height * 0.5 + 0.04, 0.02]}>
        <boxGeometry args={[width, 0.08, 0.04]} />
        <meshStandardMaterial color="#c9a227" metalness={0.4} roughness={0.35} />
      </mesh>
      <Text
        position={[0, sublabel ? height * 0.12 : 0, 0.08]}
        fontSize={fontSize}
        color={fg}
        anchorX="center"
        anchorY="middle"
        outlineWidth={fontSize * 0.04}
        outlineColor={face === 'cream' ? '#f7f2e6' : '#0a1528'}
        maxWidth={width * 0.92}
      >
        {label}
      </Text>
      {sublabel ? (
        <Text
          position={[0, -height * 0.28, 0.08]}
          fontSize={fontSize * 0.45}
          color={fg}
          anchorX="center"
          anchorY="middle"
          fillOpacity={0.9}
        >
          {sublabel}
        </Text>
      ) : null}
    </group>
  )
}

function PostMarker({
  progress,
  label,
  sublabel,
  face = 'cream',
}: {
  progress: number
  label: string
  sublabel?: string
  face?: 'cream' | 'green' | 'navy'
}) {
  const { pos, rotY, boardPos } = useMemo(() => {
    const outer = ovalPoint(progress, TRACK.outerRx + 1.35, TRACK.outerRz + 1.1)
    // Face inward toward track center
    const inward = new THREE.Vector3(-outer.x, 0, -outer.z).normalize()
    const rotY = Math.atan2(inward.x, inward.z)
    return {
      pos: outer,
      rotY,
      boardPos: [outer.x, 2.45, outer.z] as [number, number, number],
    }
  }, [progress])

  return (
    <group>
      <mesh position={[pos.x, 1.25, pos.z]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 2.5, 8]} />
        <meshStandardMaterial color="#f5f5f0" metalness={0.15} roughness={0.4} />
      </mesh>
      <mesh position={[pos.x, 0.12, pos.z]}>
        <cylinderGeometry args={[0.28, 0.32, 0.24, 8]} />
        <meshStandardMaterial color="#142038" roughness={0.6} />
      </mesh>
      <SignBoard
        position={boardPos}
        rotation={[0, rotY, 0]}
        width={4.2}
        height={1.9}
        label={label}
        sublabel={sublabel}
        face={face}
      />
    </group>
  )
}

function FinishPoles() {
  const finish = useMemo(() => ovalPoint(0.5, TRACK.centerRx, TRACK.centerRz), [])
  const finishInner = useMemo(() => ovalPoint(0.5, TRACK.innerRx + 0.15, TRACK.innerRz + 0.1), [])
  const finishOuter = useMemo(() => ovalPoint(0.5, TRACK.outerRx - 0.15, TRACK.outerRz - 0.1), [])
  const gateSpan = Math.hypot(finishOuter.x - finishInner.x, finishOuter.z - finishInner.z)
  const mid = finish
  // Board faces the grandstand (+Z) — readable from default camera
  return (
    <group>
      <mesh position={[finish.x, 0.04, finish.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.7, gateSpan]} />
        <meshStandardMaterial color="#ffffff" roughness={0.7} />
      </mesh>
      {/* Checker accent stripe */}
      <mesh position={[finish.x + 0.35, 0.045, finish.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.25, gateSpan]} />
        <meshStandardMaterial color="#142038" roughness={0.7} />
      </mesh>
      {[finishInner, finishOuter].map((p, i) => (
        <group key={i}>
          <mesh position={[p.x, 1.35, p.z]} castShadow>
            <boxGeometry args={[0.28, 2.7, 0.28]} />
            <meshStandardMaterial color="#f7f2e6" roughness={0.45} />
          </mesh>
          <mesh position={[p.x, 2.75, p.z]}>
            <boxGeometry args={[0.4, 0.2, 0.4]} />
            <meshStandardMaterial color="#c9a227" metalness={0.45} roughness={0.3} />
          </mesh>
          {/* Red/white bands */}
          {[0.5, 1.1, 1.7].map((y) => (
            <mesh key={y} position={[p.x, y, p.z]}>
              <boxGeometry args={[0.3, 0.22, 0.3]} />
              <meshStandardMaterial color="#b02028" roughness={0.5} />
            </mesh>
          ))}
        </group>
      ))}
      {/* Thin crossbar only — no giant billboard */}
      <mesh position={[mid.x, 2.85, mid.z]} castShadow>
        <boxGeometry args={[0.16, 0.16, gateSpan + 0.2]} />
        <meshStandardMaterial color="#142038" metalness={0.2} roughness={0.4} />
      </mesh>
    </group>
  )
}

function FurlongMarkers() {
  // One-mile oval (8 furlongs). Finish/wire at progress 0.5.
  // Markers show furlongs to the wire; poles get race-day labels.
  const markers = useMemo(() => {
    const poleLabel: Record<number, { label: string; sub: string }> = {
      2: { label: '¼', sub: 'POLE' },
      4: { label: '½', sub: 'POLE' },
      6: { label: '¾', sub: 'POLE' },
    }
    const items: { progress: number; label: string; sub?: string; face: 'cream' | 'green' }[] = []
    for (let f = 1; f <= 7; f++) {
      let progress = 0.5 - f / 8
      if (progress < 0) progress += 1
      const pole = poleLabel[f]
      items.push({
        progress,
        label: pole ? pole.label : `${f}F`,
        sub: pole ? pole.sub : f === 1 ? 'TO GO' : `${f} FURLONGS`,
        face: f % 2 === 0 ? 'green' : 'cream',
      })
    }
    return items
  }, [])

  return (
    <group>
      {markers.map((m) => (
        <PostMarker
          key={`${m.label}-${m.progress}`}
          progress={m.progress}
          label={m.label}
          sublabel={m.sub}
          face={m.face}
        />
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

  return (
    <group>
      {/* Outer grounds — lush venue lawn (not road / asphalt) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[160, 130]} />
        <meshStandardMaterial color="#3f8f3c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.03, 0]} receiveShadow>
        <ringGeometry args={[25, 38, 72]} />
        <meshStandardMaterial color="#4a9a45" roughness={1} />
      </mesh>
      {/* Deeper turf band past the outer rail toward the stands */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.015, 0]} receiveShadow>
        <ringGeometry args={[24.2, 27.5, 72]} />
        <meshStandardMaterial color="#2f7a32" roughness={0.95} />
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
      {/* Soft center lawn — open sightline, no infield board */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[3.6, 40]} />
        <meshStandardMaterial color={TURF} roughness={0.9} />
      </mesh>

      {/* Finish / start wire + furlong poles — open infield (no tote board) */}
      <FinishPoles />
      <FurlongMarkers />

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

      {/* Turf + cream apron flush to outer rail (~z 15.3) — no dark gap */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 15.85]} receiveShadow>
        <planeGeometry args={[46, 1.05]} />
        <meshStandardMaterial color="#3d8f3a" roughness={0.95} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 16.85]} receiveShadow>
        <planeGeometry args={[44, 1.55]} />
        <meshStandardMaterial color="#efe6d4" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 16.85]} receiveShadow>
        <planeGeometry args={[42, 0.14]} />
        <meshStandardMaterial color="#e0d4bc" roughness={0.88} />
      </mesh>
      {/* Lawn filling bottom-of-frame past the stands (toward camera) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 30]} receiveShadow>
        <planeGeometry args={[90, 28]} />
        <meshStandardMaterial color="#3a8a38" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 40]} receiveShadow>
        <planeGeometry args={[100, 18]} />
        <meshStandardMaterial color="#2f7a32" roughness={1} />
      </mesh>

      {/* Near grandstand — pulled flush toward outer rail; thin cream canopy (no navy asphalt slab) */}
      <group position={[0, 0, 17.55]}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
          <mesh key={row} position={[0, 0.35 + row * 0.48, row * 0.55]} castShadow receiveShadow>
            <boxGeometry args={[38 - row * 0.55, 0.28, 0.8]} />
            <meshStandardMaterial color={row % 2 ? STONE : CREAM} roughness={0.75} />
          </mesh>
        ))}
        <CrowdDots width={34} depth={4.0} rows={7} cols={30} baseY={0.35} baseZ={0.1} />
        {[-16, -11, -6, -2, 2, 6, 11, 16].map((x) => (
          <group key={x} position={[x, 0, 1.2]}>
            <mesh position={[0, 2.2, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.3, 4.4, 10]} />
              <meshStandardMaterial color={COLUMN} roughness={0.55} />
            </mesh>
            <mesh position={[0, 4.55, 0]}>
              <boxGeometry args={[0.65, 0.24, 0.65]} />
              <meshStandardMaterial color={STONE} roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <boxGeometry args={[0.6, 0.22, 0.6]} />
              <meshStandardMaterial color={STONE} roughness={0.65} />
            </mesh>
          </group>
        ))}
        {/* Thin cream/stone canopy — does not dominate overhead view */}
        <mesh position={[0, 5.15, 1.9]} castShadow>
          <boxGeometry args={[37.5, 0.12, 5.2]} />
          <meshStandardMaterial color={STONE} roughness={0.68} />
        </mesh>
        <mesh position={[0, 5.05, -0.55]}>
          <boxGeometry args={[36.5, 0.18, 0.2]} />
          <meshStandardMaterial color={GOLD} metalness={0.45} roughness={0.35} />
        </mesh>
        <mesh position={[0, 2.4, 4.85]} castShadow>
          <boxGeometry args={[37, 4.8, 0.45]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.5, -1.05]} castShadow receiveShadow>
          <boxGeometry args={[38.5, 1.0, 0.4]} />
          <meshStandardMaterial color={CREAM} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.05, -1.05]}>
          <boxGeometry args={[38.7, 0.14, 0.45]} />
          <meshStandardMaterial color={GOLD} metalness={0.4} roughness={0.35} />
        </mesh>
      </group>

      {/* Extended lower seating / patio beyond main stand — fills bottom of frame */}
      <group position={[0, 0, 23.2]}>
        {[0, 1, 2, 3].map((row) => (
          <mesh key={row} position={[0, 0.22 + row * 0.38, row * 0.55]} castShadow receiveShadow>
            <boxGeometry args={[44 - row * 0.4, 0.22, 0.75]} />
            <meshStandardMaterial color={row % 2 ? '#e8e0d0' : '#f3eee3'} roughness={0.8} />
          </mesh>
        ))}
        <CrowdDots width={40} depth={2.2} rows={4} cols={34} baseY={0.22} baseZ={0.1} />
        <mesh position={[0, 0.06, 2.4]} receiveShadow>
          <boxGeometry args={[48, 0.12, 4.5]} />
          <meshStandardMaterial color="#efe6d4" roughness={0.95} />
        </mesh>
      </group>

      {/* Landscaping along apron — hedges + blooms (outside oval, no clip) */}
      <FlowerBed position={[-12, 0, 16.35]} width={9} />
      <FlowerBed position={[12, 0, 16.35]} width={9} />
      <FlowerBed position={[0, 0, 16.35]} width={7} />
      <FlowerBed position={[-18, 0, 17.9]} width={6} />
      <FlowerBed position={[18, 0, 17.9]} width={6} />
      <HedgeBox position={[-20, 0.4, 16.7]} size={[8, 0.8, 0.55]} />
      <HedgeBox position={[20, 0.4, 16.7]} size={[8, 0.8, 0.55]} />
      <HedgeBox position={[0, 0.35, 17.3]} size={[34, 0.55, 0.4]} />
      <HedgeBox position={[-22, 0.45, 20.5]} size={[0.7, 0.9, 8]} />
      <HedgeBox position={[22, 0.45, 20.5]} size={[0.7, 0.9, 8]} />
      <FlowerBed position={[-8, 0, 26.4]} width={10} />
      <FlowerBed position={[8, 0, 26.4]} width={10} />

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
