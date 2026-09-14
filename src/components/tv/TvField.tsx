import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Horse } from '../../data/fakeSeason'
import { Kickup } from '../race/Kickup'
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
  trackPoint,
  trackTangent,
  type HorseSimState,
} from '../race/trackMath'
import { Thoroughbred } from './Thoroughbred'
import { tvBridge, type TvShot } from './tvBridge'

function laneToRadial(lane: number, count: number): number {
  const L = lane > 0 ? lane : 1
  const max = Math.max(count, 8)
  return THREE.MathUtils.clamp(((L - 1) / Math.max(max - 1, 1)) * 1.7 - 0.85, -0.92, 0.92)
}

function readOverall(map: Record<string, number> | undefined, id: string): number | undefined {
  if (!map) return undefined
  const direct = map[id]
  if (typeof direct === 'number' && Number.isFinite(direct)) return direct
  const asString = map[String(id)]
  if (typeof asString === 'number' && Number.isFinite(asString)) return asString
  return undefined
}

function shotFromOval(p: number, racing: boolean, atFinish = false): TvShot {
  if (atFinish) return 'wire'
  if (!racing) return 'clubhouse'
  const f = fracProgress(p)
  if (f >= 0.46 && f < 0.545) return 'wire'
  if (f >= 0.36 && f < 0.64) return 'stretch'
  if (f >= 0.16 && f < 0.36) return 'clubhouse'
  if (f >= 0.70 && f < 0.90) return 'tower'
  return 'clubhouse'
}

/** Lap 1-based from live overall, else oval wraps past the wire (demo). */
function lapForState(st: HorseSimState | undefined, laps: number): number {
  const L = laps > 0 ? laps : 1
  if (!st) return 1
  if (typeof st.lastOverall === 'number' && Number.isFinite(st.lastOverall)) {
    if (st.lastOverall >= 0.999) return L
    return Math.min(L, Math.max(1, Math.floor(st.lastOverall * L) + 1))
  }
  return Math.max(1, Math.floor(st.progress - GATE_OVAL + 0.02) + 1)
}

type FieldProps = {
  horses: Horse[]
  liveFeed: boolean
  isRacing: boolean
  trackLaps: number
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
  raceId?: string | null
}

export function TvField({
  horses,
  liveFeed,
  isRacing,
  trackLaps,
  progressRef,
  laneRef,
  raceId,
}: FieldProps) {
  const fieldRef = useRef<HorseSimState[]>(
    createFieldState(
      horses.length,
      horses.map((h) => h.speedBias),
    ),
  )
  const idKeyRef = useRef('')
  const wasRacing = useRef(false)
  const raceAgeRef = useRef(0)
  const lapsRef = useRef(trackLaps)
  const lockedLapsRef = useRef<number | null>(null)
  const raceIdRef = useRef<string | null>(raceId ?? null)
  const shotHold = useRef({ shot: 'clubhouse' as TvShot, until: 0 })

  useEffect(() => {
    const nextId = raceId ?? null
    if (nextId === raceIdRef.current) return
    raceIdRef.current = nextId
    raceAgeRef.current = 0
    lockedLapsRef.current = null
    wasRacing.current = false
    tvBridge.elapsedMs = 0
    tvBridge.leaderLap = 1
    for (const s of fieldRef.current) {
      clearLiveMotion(s)
      if (liveFeed) {
        s.progress = GATE_OVAL
        s.pace = 0
      }
    }
  }, [raceId, liveFeed])

  useEffect(() => {
    const key = horses.map((h) => h.id).join('|')
    const prevById = new Map<string, HorseSimState>()
    for (const s of fieldRef.current) {
      if (s.id) prevById.set(s.id, s)
    }
    if (key === idKeyRef.current && fieldRef.current.length === horses.length) {
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
      const holdGate =
        !isRacing &&
        horses.every((h) => {
          const overall = readOverall(progressRef?.current, h.id)
          const s = states.find((st) => st.id === h.id)
          const shown = s ? fracProgress(s.progress) : GATE_OVAL
          const offGate = Math.abs(shown - GATE_OVAL) > 0.02 && Math.abs(shown - GATE_OVAL) < 0.98
          return !((typeof overall === 'number' && overall > 0.001) || offGate)
        })

      if (holdGate) {
        horses.forEach((h, i) => {
          const s = states[i]
          if (!s) return
          s.progress = GATE_OVAL
          s.pace = 0
          clearLiveMotion(s)
          const lane = laneRef?.current[h.id] ?? i + 1
          s.radial = laneToRadial(lane, horses.length)
        })
      } else if (progressRef) {
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
          if (overall <= 0.001) s.pace = 0
          else s.pace = Math.max(0.85, Math.min(1.35, 0.9 + delta * 8))
        })
      }
    } else {
      stepField(states, clamped, 1 / 30)
    }

    // Booth pack + shot (hold 2.4s so cuts read as TV, not a fly-cam)
    let sx = 0
    let sz = 0
    let n = 0
    let best = states[0]
    for (const st of states) {
      const p = trackPoint(st.progress, st.radial)
      sx += p.x
      sz += p.z
      n++
      if (!best || fracProgress(st.progress) > fracProgress(best.progress) && st.pace > 0.05) {
        /* keep */
      }
      if (!best || (st.lastOverall ?? st.progress) > (best.lastOverall ?? best.progress)) best = st
    }
    const pack = n ? { x: sx / n, z: sz / n } : { x: 0, z: 11 }
    const lead = best ?? states[0]
    const tan = lead ? trackTangent(lead.progress, lead.radial) : new THREE.Vector3(1, 0, 0)
    tvBridge.field = states
    tvBridge.packX = pack.x
    tvBridge.packZ = pack.z
    tvBridge.packY = 0.7
    tvBridge.headingX = tan.x
    tvBridge.headingZ = tan.z
    tvBridge.leaderProgress = lead ? lead.progress : GATE_OVAL
    tvBridge.racing = liveFeed ? isRacing : true
    tvBridge.trackLaps = laps
    tvBridge.leaderLap = lapForState(lead, laps)
    const follow = tvBridge.followId
      ? states.find((st) => st.id === tvBridge.followId)
      : undefined
    if (follow) {
      const fp = trackPoint(follow.progress, follow.radial)
      const ft = trackTangent(follow.progress, follow.radial)
      tvBridge.followOk = true
      tvBridge.followX = fp.x
      tvBridge.followY = 0.7
      tvBridge.followZ = fp.z
      tvBridge.followHX = ft.x
      tvBridge.followHZ = ft.z
    } else {
      tvBridge.followOk = false
    }
    if (tvBridge.racing) tvBridge.elapsedMs += clamped * 1000
    const atFinish =
      liveFeed &&
      !isRacing &&
      states.some((st) => crossedFinish(st.lastOverall))
    const want = shotFromOval(tvBridge.leaderProgress, tvBridge.racing, atFinish)
    const nowS = performance.now() / 1000
    if (want !== shotHold.current.shot && nowS >= shotHold.current.until) {
      shotHold.current = { shot: want, until: nowS + 2.4 }
    }
    tvBridge.shot = shotHold.current.shot
  })

  const list = useMemo(() => horses, [horses])

  return (
    <>
      {list.map((horse, i) => (
        <group key={horse.id}>
          <Thoroughbred horse={horse} index={i} fieldRef={fieldRef} />
          <Kickup horseId={horse.id} index={i} fieldRef={fieldRef} surface="dirt" />
        </group>
      ))}
    </>
  )
}
