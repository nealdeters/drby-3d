import { useMemo } from 'react'
import * as THREE from 'three'
import { TRACK, ovalPoint } from './trackMath'

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
  y = 0.35,
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
      const p = ovalPoint(i / count, rx, rz)
      pts.push(p)
    }
    return pts
  }, [rx, rz, count])

  return (
    <group>
      {posts.map((p, i) => (
        <mesh key={i} position={[p.x, y, p.z]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.7, 5]} />
          <meshStandardMaterial color="#d8c4a0" metalness={0.45} roughness={0.35} />
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
  const outerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.outerRx - 0.15,
        TRACK.outerRz - 0.12,
        TRACK.outerRx + 0.45,
        TRACK.outerRz + 0.35,
        96,
      ),
    [],
  )
  const innerRailGeo = useMemo(
    () =>
      ringGeometry(
        TRACK.innerRx - 0.45,
        TRACK.innerRz - 0.35,
        TRACK.innerRx + 0.15,
        TRACK.innerRz + 0.12,
        96,
      ),
    [],
  )
  const infieldGeo = useMemo(
    () => ringGeometry(0.1, 0.1, TRACK.innerRx - 0.5, TRACK.innerRz - 0.4, 64),
    [],
  )

  // Start / finish on near stretch (progress ≈ 0.5)
  const finish = useMemo(() => ovalPoint(0.5, TRACK.centerRx, TRACK.centerRz), [])
  const finishInner = useMemo(() => ovalPoint(0.5, TRACK.innerRx + 0.3, TRACK.innerRz + 0.2), [])
  const finishOuter = useMemo(() => ovalPoint(0.5, TRACK.outerRx - 0.3, TRACK.outerRz - 0.2), [])

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[100, 80]} />
        <meshStandardMaterial color="#1a140e" roughness={1} />
      </mesh>

      {/* Dirt oval */}
      <mesh geometry={dirtGeo} receiveShadow>
        <meshStandardMaterial color="#6b4423" roughness={0.95} />
      </mesh>
      {/* Outer rail strip */}
      <mesh geometry={outerRailGeo} position={[0, 0.04, 0]}>
        <meshStandardMaterial color="#c4a574" metalness={0.4} roughness={0.35} />
      </mesh>
      {/* Inner rail strip */}
      <mesh geometry={innerRailGeo} position={[0, 0.04, 0]}>
        <meshStandardMaterial color="#c4a574" metalness={0.4} roughness={0.35} />
      </mesh>
      <RailPosts rx={TRACK.outerRx + 0.1} rz={TRACK.outerRz + 0.08} count={56} />
      <RailPosts rx={TRACK.innerRx - 0.1} rz={TRACK.innerRz - 0.08} count={40} />

      {/* Infield grass */}
      <mesh geometry={infieldGeo} position={[0, 0.01, 0]}>
        <meshStandardMaterial color="#2a3a24" roughness={0.9} />
      </mesh>

      {/* Center logo mound */}
      <mesh position={[0, 0.15, 0]}>
        <cylinderGeometry args={[2.2, 2.6, 0.3, 24]} />
        <meshStandardMaterial color="#3a2818" />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.6, 24]} />
        <meshStandardMaterial color="#c4a574" metalness={0.3} roughness={0.4} />
      </mesh>

      {/* Start gate / finish marker on near stretch */}
      <group>
        {/* Finish stripe across dirt */}
        <mesh
          position={[finish.x, 0.03, finish.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry
            args={[
              0.55,
              Math.hypot(finishOuter.x - finishInner.x, finishOuter.z - finishInner.z),
            ]}
          />
          <meshStandardMaterial color="#f0e6d2" roughness={0.8} />
        </mesh>
        {/* Gate posts */}
        <mesh position={[finishInner.x, 0.9, finishInner.z]} castShadow>
          <boxGeometry args={[0.18, 1.8, 0.18]} />
          <meshStandardMaterial color="#e8dcc8" metalness={0.3} roughness={0.4} />
        </mesh>
        <mesh position={[finishOuter.x, 0.9, finishOuter.z]} castShadow>
          <boxGeometry args={[0.18, 1.8, 0.18]} />
          <meshStandardMaterial color="#e8dcc8" metalness={0.3} roughness={0.4} />
        </mesh>
        {/* Crossbar */}
        <mesh
          position={[finish.x, 1.75, finish.z]}
          castShadow
        >
          <boxGeometry
            args={[
              0.12,
              0.12,
              Math.hypot(finishOuter.x - finishInner.x, finishOuter.z - finishInner.z),
            ]}
          />
          <meshStandardMaterial color="#c44536" metalness={0.2} roughness={0.5} />
        </mesh>
      </group>

      {/* Grandstand (near side, +Z) — low poly bleachers */}
      <group position={[0, 0, 20.5]}>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <mesh key={row} position={[0, 0.4 + row * 0.55, row * 0.7]} castShadow receiveShadow>
            <boxGeometry args={[32 - row * 0.8, 0.35, 0.9]} />
            <meshStandardMaterial color={row % 2 ? '#3a2818' : '#2a1c12'} />
          </mesh>
        ))}
        {/* Roof */}
        <mesh position={[0, 4.0, 2.6]} castShadow>
          <boxGeometry args={[34, 0.2, 7]} />
          <meshStandardMaterial color="#1a120b" metalness={0.2} roughness={0.6} />
        </mesh>
        {/* Support posts */}
        {[-14, -6, 0, 6, 14].map((x) => (
          <mesh key={x} position={[x, 1.9, 1.5]}>
            <boxGeometry args={[0.25, 3.8, 0.25]} />
            <meshStandardMaterial color="#c4a574" metalness={0.5} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Far side facade */}
      <mesh position={[0, 1.2, -18.5]} castShadow>
        <boxGeometry args={[30, 2.4, 1.2]} />
        <meshStandardMaterial color="#241a12" />
      </mesh>
      <mesh position={[0, 2.6, -18.5]}>
        <boxGeometry args={[32, 0.3, 2]} />
        <meshStandardMaterial color="#c4a574" metalness={0.35} roughness={0.4} />
      </mesh>

      {/* Floodlights */}
      {[
        [-24, 14],
        [24, 14],
        [-24, -14],
        [24, -14],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 4.5, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 9, 6]} />
            <meshStandardMaterial color="#4a3a28" />
          </mesh>
          <mesh position={[0, 9.2, 0]}>
            <boxGeometry args={[1.4, 0.3, 0.8]} />
            <meshStandardMaterial color="#e8c97a" emissive="#e8c97a" emissiveIntensity={0.4} />
          </mesh>
          <pointLight position={[0, 8.5, 0]} intensity={14} distance={45} color="#ffe2b0" />
        </group>
      ))}
    </group>
  )
}
