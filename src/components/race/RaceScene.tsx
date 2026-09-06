import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, Sky } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Track } from './Track'
import { createFieldState, stepField, type HorseSimState } from './trackMath'

/**
 * High grandstand / slight top-¾ overhead.
 * Oval outer extents ~±24 X and ~±15 Z; stands/spires push the frame to
 * roughly X±32 and Z −24…+30. Camera must sit far/high enough that both
 * straights and both turns stay in a 1280×800 (and 1920×1080) viewport.
 */
function GrandstandCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock }) => {
    if (!cam.current) return
    const t = clock.getElapsedTime()
    cam.current.position.x = Math.sin(t * 0.08) * 0.8
    cam.current.position.y = 52 + Math.sin(t * 0.12) * 0.2
    cam.current.position.z = 48 + Math.cos(t * 0.07) * 0.35
    cam.current.lookAt(0, 0.15, -0.5)
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

type FieldProps = {
  horses: Horse[]
  /** When true, drive from Ably progress/lane refs instead of local stepField */
  liveFeed: boolean
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
}

function RacingField({ horses, liveFeed, progressRef, laneRef }: FieldProps) {
  const fieldRef = useRef<HorseSimState[]>(
    createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    ),
  )
  const idOrder = useRef<string[]>(horses.map((h) => h.id))
  const prevLive = useRef(false)

  // Rebuild local sim when horse set changes (demo / roster swap)
  useEffect(() => {
    idOrder.current = horses.map((h) => h.id)
    fieldRef.current = createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    )
    // Seed lanes if live refs already have values
    if (laneRef?.current) {
      horses.forEach((h, i) => {
        const lane = laneRef.current[h.id]
        if (lane) fieldRef.current[i].radial = laneToRadial(lane, horses.length)
      })
    }
  }, [horses, laneRef])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const states = fieldRef.current

    if (liveFeed && progressRef) {
      if (!prevLive.current) {
        // Entering live: snap radials from lanes, keep forward progress
        prevLive.current = true
      }
      horses.forEach((h, i) => {
        const s = states[i]
        if (!s) return
        const target = progressRef.current[h.id]
        if (typeof target === 'number' && Number.isFinite(target)) {
          // Smooth toward live lap progress; never reverse along the oval
          const cur = ((s.progress % 1) + 1) % 1
          let tgt = ((target % 1) + 1) % 1
          // Choose shortest forward delta (prefer CCW / forward-only)
          let delta = tgt - cur
          if (delta < -0.5) delta += 1
          if (delta < 0) delta = 0 // no reverse
          if (delta > 0.35) {
            // Large jump (reconnect) — snap forward
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
      prevLive.current = false
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
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
}

export function RaceScene({
  horses,
  liveFeed = false,
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
      <Track />
      <RacingField
        horses={horses}
        liveFeed={liveFeed}
        progressRef={progressRef}
        laneRef={laneRef}
      />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
}
