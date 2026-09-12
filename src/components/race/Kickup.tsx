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

type Speck = {
  alive: boolean
  age: number
  life: number
  x: number
  y: number
  z: number
  vx: number
  vz: number
  scale: number
}

const COUNT = 6
const _obj = new THREE.Object3D()

function kickColor(surface: TrackSurface): string {
  if (surface === 'asphalt') return '#8b939c'
  if (surface === 'grass' || surface === 'turf') return '#8fa56a'
  return '#c4a078'
}

/**
 * Faint ground-hugging scuff so the pack reads as moving without a particle storm.
 * Density follows live overallRate (real pace), not follow-lag. Idle / gate = none.
 */
export function Kickup({ horseId, index, fieldRef, surface }: Props) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const parts = useRef<Speck[]>(
    Array.from({ length: COUNT }, () => ({
      alive: false,
      age: 0,
      life: 1,
      x: 0,
      y: 0.055,
      z: 0,
      vx: 0,
      vz: 0,
      scale: 0.2,
    })),
  )
  const emitAcc = useRef(0)
  const color = useMemo(() => kickColor(surface), [surface])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const s = fieldRef.current.find((st) => st.id === horseId) ?? fieldRef.current[index]
    const pace = s?.pace ?? 0
    const rate = s?.overallRate
    const moving = pace > 0.12
    // Typical live slope is ~0.02–0.04 overall/s. Demo has no rate — whisper from pace.
    const speed = moving
      ? typeof rate === 'number'
        ? THREE.MathUtils.clamp(rate / 0.035, 0.35, 1.15)
        : THREE.MathUtils.clamp(0.45 + (pace - 0.9) * 0.6, 0.35, 1.0)
      : 0
    const emitRate = moving ? 1.1 + speed * 1.6 : 0
    emitAcc.current += clamped * emitRate

    const pos = s ? trackPoint(s.progress, s.radial) : null
    const tan = s ? trackTangent(s.progress, s.radial) : null

    while (moving && emitAcc.current >= 1 && pos && tan) {
      emitAcc.current -= 1
      const slot = parts.current.find((p) => !p.alive) ?? parts.current[Math.floor(Math.random() * COUNT)]
      const side = (Math.random() - 0.5) * 0.28
      const back = 0.55 + Math.random() * 0.5
      slot.alive = true
      slot.age = 0
      slot.life = 0.22 + Math.random() * 0.18
      slot.x = pos.x - tan.x * back + tan.z * side
      slot.y = 0.05
      slot.z = pos.z - tan.z * back - tan.x * side
      const drift = 0.12 + Math.random() * 0.1
      slot.vx = -tan.x * drift + (Math.random() - 0.5) * 0.08
      slot.vz = -tan.z * drift + (Math.random() - 0.5) * 0.08
      slot.scale = (0.16 + speed * 0.06) * (0.85 + Math.random() * 0.3)
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
          p.z += p.vz * clamped
          p.vx *= 0.9
          p.vz *= 0.9
        }
      }
      const t = p.alive ? 1 - p.age / p.life : 0
      const sc = p.alive ? p.scale * (0.55 + t * 0.55) : 0
      _obj.position.set(p.x, p.y, p.z)
      // Flattened disc — reads as a scuff on the strip, not a puff in air.
      _obj.scale.set(sc, sc * 0.12, sc)
      _obj.updateMatrix()
      im.setMatrixAt(i, _obj.matrix)
    }
    im.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, COUNT]} frustumCulled={false} renderOrder={2}>
      <sphereGeometry args={[1, 5, 4]} />
      <meshBasicMaterial color={color} transparent opacity={0.22} depthWrite={false} />
    </instancedMesh>
  )
}
