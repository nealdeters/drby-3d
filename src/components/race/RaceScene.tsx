import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, Sky } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Track, type TrackSurface } from './Track'
import { createFieldState, stepField, type HorseSimState } from './trackMath'

/**
 * High grandstand / slight top-¾ overhead.
 * Oval outer extents ~±24 X and ~±15 Z; stands/spires push the frame to
 * roughly X±32 and Z −24…+30. Landscape/desktop keeps the original
 * framing; portrait/narrow aspect gently pulls back, raises, and widens FOV
 * so both turns (±outerRx) plus horse rail margin stay in frame with padding.
 */
function GrandstandCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock, size }) => {
    if (!cam.current) return
    const t = clock.getElapsedTime()
    const aspect = size.width / Math.max(size.height, 1)
    // 0 at square/landscape, 1 at typical phone portrait (~0.45)
    const narrow = THREE.MathUtils.clamp((1 - aspect) / 0.55, 0, 1)

    // Portrait boost ~25% less aggressive than prior overshoot
    const baseY = 52 + narrow * 15
    const baseZ = 48 + narrow * 21
    const fov = 50 + narrow * 12
    const lookZ = -0.5 + narrow * 0.3

    if (Math.abs(cam.current.fov - fov) > 0.01) {
      cam.current.fov = fov
      cam.current.updateProjectionMatrix()
    }

    cam.current.position.x = Math.sin(t * 0.08) * 0.8
    cam.current.position.y = baseY + Math.sin(t * 0.12) * 0.2
    cam.current.position.z = baseZ + Math.cos(t * 0.07) * 0.35
    cam.current.lookAt(0, 0.15, lookZ)
  })
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={50}
      near={0.1}
      far={500}
      position={[0, 52, 48]}
    />
  )
}

function laneToRadial(lane: number, count: number): number {
  const L = lane > 0 ? lane : 1
  const max = Math.max(count, 8)
  // lane 1 = inside (−), higher lanes = outside (+)
  return THREE.MathUtils.clamp(((L - 1) / Math.max(max - 1, 1)) * 1.7 - 0.85, -0.92, 0.92)
}

/** Scheduler progressMap is overall 0–1; map to our oval (finish wire at 0.5). */
export function overallToOvalProgress(overall: number, laps: number): number {
  const L = laps > 0 ? laps : 1
  const lapFrac = ((((overall * L) % 1) + 1) % 1)
  return (lapFrac + 0.5) % 1
}

const GATE_OVAL = 0.5

type FieldProps = {
  horses: Horse[]
  /** Live mode (subscribed): never run demo stepField — gate-hold or follow progressMap */
  liveFeed: boolean
  /** When liveFeed and racing, follow progressMap; otherwise hold at gate */
  isRacing: boolean
  /** Track lap count for overall→lapFrac mapping (default 1) */
  trackLaps: number
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
}

function RacingField({
  horses,
  liveFeed,
  isRacing,
  trackLaps,
  progressRef,
  laneRef,
}: FieldProps) {
  const fieldRef = useRef<HorseSimState[]>(
    createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    ),
  )
  const idKeyRef = useRef('')
  const wasRacing = useRef(false)
  const lapsRef = useRef(trackLaps)
  lapsRef.current = trackLaps

  // Rebuild local sim only when the horse identity set changes (not every tick)
  useEffect(() => {
    const key = horses.map((h) => h.id).join('|')
    if (key === idKeyRef.current && fieldRef.current.length === horses.length) {
      // Still refresh radials from lanes without resetting progress
      if (laneRef?.current) {
        horses.forEach((h, i) => {
          const lane = laneRef.current[h.id]
          if (lane && fieldRef.current[i]) {
            fieldRef.current[i].radial = laneToRadial(lane, horses.length)
          }
        })
      }
      return
    }
    idKeyRef.current = key
    fieldRef.current = createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    )
    // Live gate: finish/start wire at oval 0.5 with lane radials
    horses.forEach((h, i) => {
      const s = fieldRef.current[i]
      if (!s) return
      if (liveFeed) {
        s.progress = GATE_OVAL - (i / Math.max(horses.length, 1)) * 0.012
      }
      const lane = laneRef?.current[h.id]
      if (lane) s.radial = laneToRadial(lane, horses.length)
    })
  }, [horses, laneRef, liveFeed])

  // On race start: snap pack to gate before following live
  useEffect(() => {
    if (liveFeed && isRacing && !wasRacing.current) {
      horses.forEach((h, i) => {
        const s = fieldRef.current[i]
        if (!s) return
        s.progress = GATE_OVAL - (i / Math.max(horses.length, 1)) * 0.012
        const lane = laneRef?.current[h.id]
        if (typeof lane === 'number' && lane > 0) {
          s.radial = laneToRadial(lane, horses.length)
        }
      })
    }
    wasRacing.current = isRacing
  }, [liveFeed, isRacing, horses, laneRef])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const states = fieldRef.current
    const laps = lapsRef.current > 0 ? lapsRef.current : 1

    if (liveFeed) {
      if (!isRacing || !progressRef) {
        // Gate hold / idle between races — do not run demo stepField
        horses.forEach((h, i) => {
          const s = states[i]
          if (!s) return
          const gate = GATE_OVAL - (i / Math.max(horses.length, 1)) * 0.012
          s.progress = THREE.MathUtils.lerp(s.progress, gate, 1 - Math.exp(-clamped * 6))
          s.pace = 0.85
          const lane = laneRef?.current[h.id] ?? i + 1
          const desired = laneToRadial(lane, horses.length)
          s.radial = THREE.MathUtils.lerp(s.radial, desired, 1 - Math.exp(-clamped * 5))
        })
        return
      }

      horses.forEach((h, i) => {
        const s = states[i]
        if (!s) return
        const overall = progressRef.current[h.id]
        if (typeof overall === 'number' && Number.isFinite(overall)) {
          const tgt = overallToOvalProgress(overall, laps)
          const cur = ((s.progress % 1) + 1) % 1
          let delta = tgt - cur
          if (delta < -0.5) delta += 1
          if (delta < 0) delta = 0 // no reverse
          if (delta > 0.35) {
            // Large jump (reconnect / lap wrap catch-up) — snap forward
            s.progress = Math.floor(s.progress) + tgt
          } else {
            s.progress = advanceForward(s.progress, delta * Math.min(1, clamped * 12))
          }
          s.pace = Math.max(0.85, Math.min(1.35, 0.9 + delta * 8))
        }
        const lane = laneRef?.current[h.id]
        if (typeof lane === 'number' && lane > 0) {
          const desired = laneToRadial(lane, horses.length)
          s.radial = THREE.MathUtils.lerp(s.radial, desired, 1 - Math.exp(-clamped * 5))
        }
      })
    } else {
      stepField(states, clamped, 1 / 30)
    }
  })

  const list = useMemo(() => horses, [horses])

  return (
    <>
      {list.map((horse, i) => (
        <HorseMesh key={horse.id} horse={horse} index={i} fieldRef={fieldRef} />
      ))}
    </>
  )
}

function advanceForward(progress: number, delta: number): number {
  return progress + Math.max(0, delta)
}

export type RaceSceneProps = {
  horses: Horse[]
  liveFeed?: boolean
  isRacing?: boolean
  trackLaps?: number
  /** Racing surface look for the oval strip */
  surface?: TrackSurface
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
}

export function RaceScene({
  horses,
  liveFeed = false,
  isRacing = false,
  trackLaps = 1,
  surface = 'dirt',
  progressRef,
  laneRef,
}: RaceSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#87b8e8']} />
      {/* Soft daylight haze — starts past the far rail so the oval stays clear */}
      <fog attach="fog" args={['#c8dcf0', 140, 320]} />
      <GrandstandCamera />
      <Sky
        distance={450000}
        sunPosition={[80, 35, 40]}
        inclination={0.48}
        azimuth={0.22}
        mieCoefficient={0.004}
        mieDirectionalG={0.8}
        rayleigh={0.65}
        turbidity={4}
      />
      <ambientLight intensity={0.55} color="#fff4e0" />
      <hemisphereLight args={['#b8d4f5', '#7a9a4a', 0.45]} />
      <directionalLight
        castShadow
        position={[28, 42, 18]}
        intensity={1.55}
        color="#ffe8b8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={140}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-20, 18, -12]} intensity={0.35} color="#a8c8f0" />
      <Track key={surface} surface={surface} />
      <RacingField
        horses={horses}
        liveFeed={liveFeed}
        isRacing={isRacing}
        trackLaps={trackLaps}
        progressRef={progressRef}
        laneRef={laneRef}
      />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
}
