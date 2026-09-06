import { useMemo } from 'react'
import * as THREE from 'three'

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

export function Track() {
  const dirtGeo = useMemo(() => ringGeometry(8.5, 4.5, 22, 13.5), [])
  const railGeo = useMemo(() => ringGeometry(21.6, 13.1, 22.2, 13.7, 80), [])
  const infieldGeo = useMemo(() => ringGeometry(0.1, 0.1, 8.4, 4.4, 64), [])

  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[80, 60]} />
        <meshStandardMaterial color="#1a140e" roughness={1} />
      </mesh>

      {/* Dirt oval */}
      <mesh geometry={dirtGeo} rotation={[0, 0, 0]} receiveShadow>
        <meshStandardMaterial color="#6b4423" roughness={0.95} />
      </mesh>
      {/* Inner rail strip */}
      <mesh geometry={railGeo}>
        <meshStandardMaterial color="#c4a574" metalness={0.4} roughness={0.35} />
      </mesh>
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

      {/* Grandstand (behind camera / near side) — low poly bleachers */}
      <group position={[0, 0, 18]}>
        {[0, 1, 2, 3, 4].map((row) => (
          <mesh key={row} position={[0, 0.4 + row * 0.55, row * 0.7]} castShadow receiveShadow>
            <boxGeometry args={[28 - row * 0.8, 0.35, 0.9]} />
            <meshStandardMaterial color={row % 2 ? '#3a2818' : '#2a1c12'} />
          </mesh>
        ))}
        {/* Roof */}
        <mesh position={[0, 3.4, 2.2]} castShadow>
          <boxGeometry args={[30, 0.2, 6]} />
          <meshStandardMaterial color="#1a120b" metalness={0.2} roughness={0.6} />
        </mesh>
        {/* Support posts */}
        {[-12, -4, 4, 12].map((x) => (
          <mesh key={x} position={[x, 1.6, 1.5]}>
            <boxGeometry args={[0.25, 3.2, 0.25]} />
            <meshStandardMaterial color="#c4a574" metalness={0.5} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Far side facade */}
      <mesh position={[0, 1.2, -16]} castShadow>
        <boxGeometry args={[26, 2.4, 1.2]} />
        <meshStandardMaterial color="#241a12" />
      </mesh>
      <mesh position={[0, 2.6, -16]}>
        <boxGeometry args={[28, 0.3, 2]} />
        <meshStandardMaterial color="#c4a574" metalness={0.35} roughness={0.4} />
      </mesh>

      {/* Floodlights */}
      {[
        [-20, 12],
        [20, 12],
        [-20, -12],
        [20, -12],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 4, 0]}>
            <cylinderGeometry args={[0.12, 0.18, 8, 6]} />
            <meshStandardMaterial color="#4a3a28" />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <boxGeometry args={[1.4, 0.3, 0.8]} />
            <meshStandardMaterial color="#e8c97a" emissive="#e8c97a" emissiveIntensity={0.4} />
          </mesh>
          <pointLight position={[0, 7.5, 0]} intensity={12} distance={35} color="#ffe2b0" />
        </group>
      ))}
    </group>
  )
}
