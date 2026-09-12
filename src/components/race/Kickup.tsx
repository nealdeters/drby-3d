import { useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { HorseSimState } from './trackMath'
import { trackPoint, trackTangent } from './trackMath'
import type { TrackSurface } from './Track'

type Props = {
  horseId: string
  index: number
  fieldRef: MutableRefObject<HorseSimState[]>
  surface: TrackSurface
}

type Particle = {
  alive: boolean
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  scale: number
}

const COUNT = 14
const _obj = new THREE.Object3D()

function kickColor(surface: TrackSurface): string {
  if (surface === 'asphalt') return '#c5ccd4'
  if (surface === 'grass' || surface === 'turf') return '#d7e6a4'
  return '#e6c9a0'
}

/**
 * Light hoof spray so pace reads from the grandstand: more / higher when
 * a horse is gaining, thinner and shorter when they fade. Idle = none.
 */
export function Kickup({ horseId, index, fieldRef, surface }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const parts = useRef<Particle[]>(
    Array.from({ length: COUNT }, () => ({
      alive: false,
      age: 0,
      life: 1,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0.4,
    })),
  )
  const emitAcc = useRef(0)
  const prevPace = useRef(0)
  const color = useMemo(() => kickColor(surface), [surface])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const s = fieldRef.current.find((st) => st.id === horseId) ?? fieldRef.current[index]
    const pace = s?.pace ?? 0
    const dPace = pace - prevPace.current
    prevPace.current = pace
    const moving = pace > 0.12
    const gaining = moving && dPace > 0.004
    const fading = moving && dPace < -0.004
    const gain = moving ? THREE.MathUtils.clamp(dPace * 10 + (pace - 0.95) * 1.6, 0, 2.2) : 0
    const rate = moving
      ? (5 + pace * 16 + gain * 12) * (fading ? 0.4 : gaining ? 1.35 : 1)
      : 0
    emitAcc.current += clamped * rate

    const pos = s ? trackPoint(s.progress, s.radial) : null
    const tan = s ? trackTangent(s.progress, s.radial) : null

    while (moving && emitAcc.current >= 1 && pos && tan) {
      emitAcc.current -= 1
      const slot = parts.current.find((p) => !p.alive) ?? parts.current[Math.floor(Math.random() * COUNT)]
      const side = (Math.random() - 0.5) * 0.7
      const back = 0.45 + Math.random() * 0.85
      slot.alive = true
      slot.age = 0
      slot.life = fading ? 0.28 + Math.random() * 0.18 : 0.5 + Math.random() * 0.4
      slot.x = pos.x - tan.x * back + tan.z * side
      slot.y = 0.1 + Math.random() * 0.08
      slot.z = pos.z - tan.z * back - tan.x * side
      const kick = (fading ? 0.45 : 1 + gain * 0.55) * (0.65 + Math.random() * 0.7)
      slot.vx = -tan.x * kick * 0.4 + (Math.random() - 0.5) * 0.55
      slot.vy = (fading ? 0.45 : 1.05 + gain * 0.7) * (0.55 + Math.random() * 0.7)
      slot.vz = -tan.z * kick * 0.4 + (Math.random() - 0.5) * 0.55
      slot.scale = (fading ? 0.38 : 0.55 + pace * 0.22 + gain * 0.12) * (0.75 + Math.random() * 0.55)
    }
    if (!moving) emitAcc.current = 0

    const im = mesh.current
    if (!im) return
    for (let i = 0; i < COUNT; i++) {
      const p = parts.current[i]
      if (p.alive) {
        p.age += clamped
        if (p.age >= p.life) {
          p.alive = false
        } else {
          p.x += p.vx * clamped
          p.y += p.vy * clamped
          p.z += p.vz * clamped
          p.vy -= 3.1 * clamped
          p.vx *= 0.95
          p.vz *= 0.95
          if (p.y < 0.05) {
            p.y = 0.05
            p.vy *= -0.08
            p.vx *= 0.65
            p.vz *= 0.65
          }
        }
      }
      const t = p.alive ? 1 - p.age / p.life : 0
      const sc = p.alive ? p.scale * (0.5 + t * 0.75) : 0
      _obj.position.set(p.x, p.y, p.z)
      _obj.scale.set(sc, sc * 0.7, sc)
      _obj.updateMatrix()
      im.setMatrixAt(i, _obj.matrix)
    }
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} renderOrder={3}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.62} depthWrite={false} />
    </instancedMesh>
  )
}
