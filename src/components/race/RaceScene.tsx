import { memo, useEffect, useMemo, useRef, Suspense, type MutableRefObject } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
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
  continuePastFinish,
  stopAfterRace,
  followOvalToward,
  fracProgress,
  overallRateFromSamples,
  overallToOvalProgress,
  stepField,
  trackPoint,
  trackTangent,
  type HorseSimState,
} from './trackMath'
import { RaceCamera } from './RaceCamera'
import { raceBridge } from './raceBridge'
import { laneToRadial, moveRadialToward } from './laneMotion'
import { chooseTrafficLanes } from './trafficLanePlanner'
import { DEFAULT_VIEW, VIEW_AERIAL, VIEW_CHASE, type ViewMode } from './cameraViews'

export { overallToOvalProgress, GATE_OVAL }

function nowForFrame(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

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
  /** Continuous lane position from the simulator (fractional lane number). */
  lanePositionRef?: MutableRefObject<Record<string, number>>
  /** Active authoritative transitions; tactical fallback never overrides these. */
  laneChangeRef?: MutableRefObject<Record<string, { from?: number; to?: number; progress?: number }>>
  /** Current live race id — reset motion when it changes */
  raceId?: string | null
  surface?: TrackSurface
  followId?: string | null
  viewMode?: ViewMode
  onPick?: (id: string) => void
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
  lanePositionRef,
  laneChangeRef,
  raceId,
  surface = 'dirt',
  followId = null,
  viewMode = DEFAULT_VIEW,
  onPick,
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
  const traceEnabledRef = useRef(false)
  /** Display target used only when an old feed supplies fixed lanes without motion. */
  const tacticalLaneRef = useRef<Record<string, number>>({})
  const lastServerLaneRef = useRef<Record<string, number>>({})
  const serverMotionCountRef = useRef(0)
  const tacticalModeRef = useRef(false)
  const nextTacticalDecisionAtRef = useRef(0)
  const tacticalDecisionRef = useRef<Record<string, ReturnType<typeof chooseTrafficLanes>[number]>>({})

  useEffect(() => {
    traceEnabledRef.current = new URLSearchParams(window.location.search).get('debug') === '1'
  }, [])

  // New race identity: park on the wire and drop leftover lastOverall from the previous race.
  useEffect(() => {
    const nextId = raceId ?? null
    if (nextId === raceIdRef.current) return
    raceIdRef.current = nextId
    raceAgeRef.current = 0
    lockedLapsRef.current = null
    wasRacing.current = false
    tacticalLaneRef.current = {}
    lastServerLaneRef.current = {}
    serverMotionCountRef.current = 0
    tacticalModeRef.current = false
    nextTacticalDecisionAtRef.current = 0
    tacticalDecisionRef.current = {}
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
        const lane = lanePositionRef?.current[h.id] ?? laneRef?.current[h.id] ?? i + 1
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
      const lane = lanePositionRef?.current[h.id] ?? laneRef?.current[h.id] ?? i + 1
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
  }, [horses, laneRef, lanePositionRef, liveFeed])

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
        // If a live snapshot already has them off the gate (late join / flicker), do not yank home.
        if (!alreadyOut) {
          s.progress = GATE_OVAL
          s.pace = 0
        }
        const lane = lanePositionRef?.current[h.id] ?? laneRef?.current[h.id] ?? i + 1
        s.radial = laneToRadial(lane, horses.length)
      })
    }
    if (!isRacing) {
      raceAgeRef.current = 0
      lockedLapsRef.current = null
    }
    wasRacing.current = isRacing
  }, [liveFeed, isRacing, horses, laneRef, lanePositionRef, trackLaps])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    const states = fieldRef.current
    if (lockedLapsRef.current == null && trackLaps > 0) {
      lapsRef.current = trackLaps
    }
    const laps = (lockedLapsRef.current ?? lapsRef.current) > 0 ? (lockedLapsRef.current ?? lapsRef.current) : 1

    // Some older race snapshots carry only a fixed integer lane. Do not let
    // that erase the positional racing behavior: after a short observation
    // window, run a deterministic traffic planner in the renderer until the
    // authoritative feed demonstrates real lateral motion. This is a visual
    // fallback, not a replacement for server lane decisions.
    if (liveFeed && isRacing) {
      const serverLanes = lanePositionRef?.current ?? {}
      for (const h of horses) {
        const serverLane = serverLanes[h.id]
        if (typeof serverLane !== 'number' || !Number.isFinite(serverLane)) continue
        const previous = lastServerLaneRef.current[h.id]
        if (previous !== undefined && Math.abs(serverLane - previous) > 0.04) {
          serverMotionCountRef.current += 1
        }
        lastServerLaneRef.current[h.id] = serverLane
        if (tacticalLaneRef.current[h.id] === undefined) tacticalLaneRef.current[h.id] = serverLane
      }
      // Three real transitions are enough evidence that the backend is driving
      // this race. Otherwise fixed-lane feeds get visible traffic behavior.
      tacticalModeRef.current =
        raceAgeRef.current > 1.25 && serverMotionCountRef.current < 3
      if (tacticalModeRef.current && nowForFrame() >= nextTacticalDecisionAtRef.current) {
        const snapshots = horses.map((h, i) => {
          const state = states.find((candidate) => candidate.id === h.id) ?? states[i]
          const serverLane = serverLanes[h.id] ?? i + 1
          return {
            id: h.id,
            progress: state?.lastOverall ?? readOverall(progressRef?.current, h.id) ?? 0,
            lane: tacticalLaneRef.current[h.id] ?? serverLane,
            speed: state?.overallRate ?? 0.032,
            strategy: h.speedBias >= 1.03 ? 'aggressive' as const : h.speedBias <= 0.98 ? 'conservative' as const : 'balanced' as const,
          }
        })
        const planned = chooseTrafficLanes(snapshots, Math.max(8, horses.length))
        tacticalDecisionRef.current = Object.fromEntries(planned.map((decision) => [decision.horseId, decision]))
        for (const decision of planned) {
          tacticalLaneRef.current[decision.horseId] = decision.targetLane
        }
        nextTacticalDecisionAtRef.current = nowForFrame() + 0.55
      }
    }

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
          const lane = lanePositionRef?.current[h.id] ?? laneRef?.current[h.id] ?? i + 1
          s.radial = laneToRadial(lane, horses.length)
        })
      } else if (!progressRef) {
        // Keep last pose — never gate-warp just because the map ref is missing a frame.
      } else {

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
        const serverLane = lanePositionRef?.current[h.id] ?? laneRef?.current[h.id] ?? i + 1
        const authoritativeChange = laneChangeRef?.current[h.id]
        const lane =
          tacticalModeRef.current && !authoritativeChange
            ? (tacticalLaneRef.current[h.id] ?? serverLane)
            : serverLane
        const targetRadial = laneToRadial(lane, horses.length)
        // Follow a continuous server lane when available; fixed-lane feeds use
        // the traffic planner above. Both paths use the same slow lateral easing.
        s.radial = moveRadialToward(s.radial, targetRadial, clamped, 4.5)
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
          // A finisher keeps the same forward stride while other horses are
          // still racing. The race-level finished packet is the only stop.
          if (isRacing) continuePastFinish(s, clamped, laps, true)
          else stopAfterRace(s)
          return
        }
        // Race-level completion stops the remaining stride where it is; never
        // warp every horse back to the finish wire.
        if (!isRacing) {
          stopAfterRace(s)
          return
        }
        let overall = coastOverall(
          s.lastOverall,
          s.overallRate,
          typeof s.lastSampleAt === 'number' ? (now - s.lastSampleAt) / 1000 : 0,
          s.lastOverall > 0.001 && s.lastOverall < 0.999,
        )
        if (crossedFinish(overall)) {
          continuePastFinish(s, clamped, laps, true)
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
      }
    } else {
      stepField(states, clamped, 1 / 30)
    }

    if (traceEnabledRef.current) {
      const debugGlobal = globalThis as typeof globalThis & {
        __DRBY3D_RACE_DEBUG__?: {
          frameCount: number
          tacticalMode?: boolean
          tacticalDecisions?: Record<string, ReturnType<typeof chooseTrafficLanes>[number]>
          horses: Array<{ id?: string; progress: number; radial: number; lanePosition?: number; finishCruising?: boolean }>
        }
      }
      const trace = debugGlobal.__DRBY3D_RACE_DEBUG__ ?? { frameCount: 0, horses: [] }
      trace.frameCount += 1
      trace.tacticalMode = tacticalModeRef.current
      trace.tacticalDecisions = tacticalDecisionRef.current
      trace.horses = states.map((s) => ({
        id: s.id,
        progress: s.progress,
        radial: s.radial,
        lanePosition: s.id ? lanePositionRef?.current[s.id] : undefined,
        finishCruising: s.finishCruising,
      }))
      debugGlobal.__DRBY3D_RACE_DEBUG__ = trace
    }

    // Publish pack / follow poses for RaceCamera
    const ranked = [...states].filter((s) => s?.id)
    ranked.sort((a, b) => (b.lastOverall ?? fracProgress(b.progress)) - (a.lastOverall ?? fracProgress(a.progress)))
    const lead = ranked[0]
    if (lead) {
      const lp = trackPoint(lead.progress, lead.radial)
      const lt = trackTangent(lead.progress, lead.radial)
      raceBridge.packX = lp.x
      raceBridge.packY = 0.7
      raceBridge.packZ = lp.z
      raceBridge.headingX = lt.x
      raceBridge.headingZ = lt.z
    }
    const pts: { x: number; y: number; z: number }[] = []
    const tans: { x: number; y: number; z: number }[] = []
    for (const s of ranked.slice(0, 6)) {
      const p = trackPoint(s.progress, s.radial)
      const tn = trackTangent(s.progress, s.radial)
      pts.push({ x: p.x, y: 0.7, z: p.z })
      tans.push({ x: tn.x, y: 0, z: tn.z })
    }
    raceBridge.packPoints = pts
    raceBridge.packTangents = tans
    const wantFollow = Boolean(followId) || viewMode === VIEW_AERIAL || viewMode === VIEW_CHASE
    const sub = wantFollow
      ? (followId ? states.find((st) => st.id === followId) : lead) || lead
      : null
    if (sub) {
      const fp = trackPoint(sub.progress, sub.radial)
      const ft = trackTangent(sub.progress, sub.radial)
      raceBridge.followOk = true
      raceBridge.followX = fp.x
      raceBridge.followY = 0.7
      raceBridge.followZ = fp.z
      raceBridge.followHX = ft.x
      raceBridge.followHZ = ft.z
    } else {
      raceBridge.followOk = false
    }
  })

  const list = useMemo(() => horses, [horses])

  return (
    <>
      {list.map((horse, i) => (
        <group key={horse.id}>
          <Suspense fallback={null}>
            <HorseMesh horse={horse} index={i} fieldRef={fieldRef} onPick={onPick} selected={followId === horse.id} />
          </Suspense>
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
  /** Continuous lane position from the simulator (fractional lane number). */
  lanePositionRef?: MutableRefObject<Record<string, number>>
  laneChangeRef?: MutableRefObject<Record<string, { from?: number; to?: number; progress?: number }>>
  raceId?: string | null
  viewMode?: ViewMode
  followId?: string | null
  homeNonce?: number
  onPick?: (id: string) => void
}

export const RaceScene = memo(function RaceScene({
  horses,
  liveFeed = false,
  isRacing = false,
  trackLaps = 1,
  surface = 'dirt',
  progressRef,
  laneRef,
  lanePositionRef,
  laneChangeRef,
  raceId = null,
  viewMode = DEFAULT_VIEW,
  followId = null,
  homeNonce = 0,
  onPick,
}: RaceSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#87b8e8']} />
      {/* Soft daylight haze — starts past the far rail so the oval stays clear */}
      <fog attach="fog" args={['#c8dcf0', 140, 320]} />
      <RaceCamera viewMode={viewMode} homeNonce={homeNonce} />
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
        lanePositionRef={lanePositionRef}
        laneChangeRef={laneChangeRef}
        raceId={raceId}
        surface={surface}
        followId={followId}
        viewMode={viewMode}
        onPick={onPick}
      />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
})
