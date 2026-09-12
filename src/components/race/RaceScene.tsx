import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, Sky } from '@react-three/drei'
import * as THREE from 'three'
import type { Horse } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Kickup } from './Kickup'
import { Track, type TrackSurface } from './Track'
import {
  GATE_OVAL,
  clearLiveMotion,
  coastOverall,
  compressOverallToPack,
  createFieldState,
  crossedFinish,
  followOvalToward,
  fracProgress,
  overallRateFromSamples,
  overallToOvalProgress,
  parkAtFinish,
  stepField,
  type HorseSimState,
} from './trackMath'

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
      near={1}
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

export { overallToOvalProgress, GATE_OVAL }

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
  /** Current live race id — reset motion when it changes */
  raceId?: string | null
  surface?: TrackSurface
}

function readOverall(map: Record<string, number> | undefined, id: string): number | undefined {
  if (!map) return undefined
  const direct = map[id]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const asString = map[String(id)]
  if (typeof asString === 'number' && Number.isFinite(asString)) return asString
  return undefined
}

function RacingField({
  horses,
  liveFeed,
  isRacing,
  trackLaps,
  progressRef,
  laneRef,
  raceId,
  surface = 'dirt',
}: FieldProps) {
  const fieldRef = useRef<HorseSimState[]>(
    createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    ),
  )
  const idKeyRef = useRef('')
  const wasRacing = useRef(false)
  /** Seconds since isRacing flipped true — soft catch-up at the break */
  const raceAgeRef = useRef(0)
  const lapsRef = useRef(trackLaps)
  // Freeze lap mapping once the pack is off the gate so a roster refresh cannot wrap them.
  const lockedLapsRef = useRef<number | null>(null)
  const raceIdRef = useRef<string | null>(raceId ?? null)

  // New race identity: park on the wire and drop leftover lastOverall from the previous race.
  useEffect(() => {
    const nextId = raceId ?? null
    if (nextId === raceIdRef.current) return
    raceIdRef.current = nextId
    raceAgeRef.current = 0
    lockedLapsRef.current = null
    wasRacing.current = false
    for (const s of fieldRef.current) {
      clearLiveMotion(s)
      if (liveFeed) {
        s.progress = GATE_OVAL
        s.pace = 0
      }
    }
  }, [raceId, liveFeed])

  // Rebuild local sim only when the horse identity set changes (not every tick)
  useEffect(() => {
    const key = horses.map((h) => h.id).join('|')
    const prevById = new Map<string, HorseSimState>()
    for (const s of fieldRef.current) {
      if (s.id) prevById.set(s.id, s)
    }
    if (key === idKeyRef.current && fieldRef.current.length === horses.length) {
      // Still refresh radials from lanes without resetting progress
      horses.forEach((h, i) => {
        const s = fieldRef.current[i]
        if (!s) return
        s.id = h.id
        const lane = laneRef?.current[h.id] ?? i + 1
        s.radial = laneToRadial(lane, horses.length)
      })
      return
    }
    idKeyRef.current = key
    const next = createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    )
    horses.forEach((h, i) => {
      const s = next[i]
      if (!s) return
      const lane = laneRef?.current[h.id] ?? i + 1
      s.id = h.id
      s.radial = laneToRadial(lane, horses.length)
      const prev = prevById.get(h.id)
      if (prev && Number.isFinite(prev.progress)) {
        // Keep the horse on the oval across roster reshuffles — never gate-warp mid-race.
        s.progress = prev.progress
        s.pace = prev.pace
        s.lastOverall = prev.lastOverall
        s.lastSampleAt = prev.lastSampleAt
        s.overallRate = prev.overallRate
      } else if (liveFeed) {
        s.progress = GATE_OVAL
        s.pace = 0
      }
    })
    fieldRef.current = next
  }, [horses, laneRef, liveFeed])

  // On race start: park pack on the wire in lanes (no stagger, no ease-in delay)
  useEffect(() => {
    if (liveFeed && isRacing && !wasRacing.current) {
      raceAgeRef.current = 0
      lockedLapsRef.current = trackLaps > 0 ? trackLaps : 1
      lapsRef.current = lockedLapsRef.current
      horses.forEach((h, i) => {
        const s = fieldRef.current[i]
        if (!s) return
        const shown = fracProgress(s.progress)
        const offWire = Math.abs(shown - GATE_OVAL) > 0.02 && Math.abs(shown - GATE_OVAL) < 0.98
        const alreadyOut = (s.lastOverall ?? 0) > 0.02 || offWire
        // If Ably already has them off the gate (late join / flicker), do not yank home.
        if (!alreadyOut) {
          s.progress = GATE_OVAL
          s.pace = 0
        }
        const lane = laneRef?.current[h.id] ?? i + 1
        s.radial = laneToRadial(lane, horses.length)
      })
    }
    if (!isRacing) {
      raceAgeRef.current = 0
      lockedLapsRef.current = null
    }
    wasRacing.current = isRacing
  }, [liveFeed, isRacing, horses, laneRef, trackLaps])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const states = fieldRef.current
    if (lockedLapsRef.current == null && trackLaps > 0) {
      lapsRef.current = trackLaps
    }
    const laps = (lockedLapsRef.current ?? lapsRef.current) > 0 ? (lockedLapsRef.current ?? lapsRef.current) : 1

    if (liveFeed) {
      const followRate = 14
      const holdGate = !isRacing && horses.every((h) => {
        const overall = readOverall(progressRef?.current, h.id)
        const s = states.find((st) => st.id === h.id)
        const shown = s ? fracProgress(s.progress) : GATE_OVAL
        const offGate = Math.abs(shown - GATE_OVAL) > 0.02 && Math.abs(shown - GATE_OVAL) < 0.98
        return !((typeof overall === 'number' && overall > 0.001) || offGate)
      })

      if (holdGate) {
        // True pre-race: freeze on the start wire in assigned lanes.
        horses.forEach((h, i) => {
          const s = states[i]
          if (!s) return
          s.progress = GATE_OVAL
          s.pace = 0
          clearLiveMotion(s)
          const lane = laneRef?.current[h.id] ?? i + 1
          s.radial = laneToRadial(lane, horses.length)
        })
        return
      }
      if (!progressRef) {
        // Keep last pose — never gate-warp just because the map ref is missing a frame.
        return
      }

      raceAgeRef.current += clamped
      const now = performance.now()
      let leaderOverall = 0
      if (isRacing) {
        for (const st of states) {
          const v = st.lastOverall
          if (typeof v === 'number' && v > leaderOverall) leaderOverall = v
        }
      }

      horses.forEach((h, i) => {
        const s = states[i]
        if (!s) return
        const lane = laneRef?.current[h.id] ?? i + 1
        s.radial = laneToRadial(lane, horses.length)
        const sample = readOverall(progressRef.current, h.id)
        if (typeof sample === 'number') {
          const prevOverall = s.lastOverall
          const rewind =
            typeof prevOverall === 'number' && sample + 0.002 < prevOverall && prevOverall < 0.998
          if (!rewind) {
            if (typeof prevOverall === 'number' && typeof s.lastSampleAt === 'number') {
              const rate = overallRateFromSamples(prevOverall, sample, (now - s.lastSampleAt) / 1000)
              if (rate != null) s.overallRate = rate
              else if (sample - prevOverall > 0.03) s.overallRate = undefined
            }
            s.lastOverall = sample
            s.lastSampleAt = now
          }
        }
        if (typeof s.lastOverall !== 'number') {
          if (!isRacing) {
            s.pace = 0
            s.overallRate = 0
          }
          return
        }
        if (crossedFinish(s.lastOverall)) {
          parkAtFinish(s, clamped, followRate)
          return
        }
        // Race over: every remaining horse stops the stride (no in-place gallop).
        if (!isRacing) {
          s.pace = 0
          s.overallRate = 0
          return
        }
        let overall = coastOverall(
          s.lastOverall,
          s.overallRate,
          typeof s.lastSampleAt === 'number' ? (now - s.lastSampleAt) / 1000 : 0,
          s.lastOverall > 0.001 && s.lastOverall < 0.999,
        )
        if (crossedFinish(overall)) {
          parkAtFinish(s, clamped, followRate)
          return
        }
        overall = compressOverallToPack(overall, leaderOverall, laps)
        const tgt = overallToOvalProgress(overall, laps)
        const delta = followOvalToward(s, tgt, clamped, followRate, overall)
        if (overall <= 0.001) {
          s.pace = 0
        } else {
          s.pace = Math.max(0.85, Math.min(1.35, 0.9 + delta * 8))
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
        <group key={horse.id}>
          <HorseMesh horse={horse} index={i} fieldRef={fieldRef} />
          <Kickup horseId={horse.id} index={i} fieldRef={fieldRef} surface={surface} />
        </group>
      ))}
    </>
  )
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
  raceId?: string | null
}

export const RaceScene = memo(function RaceScene({
  horses,
  liveFeed = false,
  isRacing = false,
  trackLaps = 1,
  surface = 'dirt',
  progressRef,
  laneRef,
  raceId = null,
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
        raceId={raceId}
        surface={surface}
      />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
})
