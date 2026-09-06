import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { getAblyClient, getRaceChannel, hasAblyKeyConfigured } from '../services/apiClient'
import type { LiveRacer, RaceUpdate } from '../types/live'

export type LiveFeedState = {
  /** Ably key present and channel subscribed (or connected) */
  feedConnected: boolean
  isRacing: boolean
  status: 'idle' | 'waiting' | 'racing' | 'finished'
  elapsed: number
  /** Overall race progress 0–1 per racer (from progressMap) — mutated in place for R3F */
  progressRef: MutableRefObject<Record<string, number>>
  /** Lane 1–n per racer */
  laneRef: MutableRefObject<Record<string, number>>
  racers: LiveRacer[]
}

type Options = {
  raceId: string | null | undefined
  /** Subscribe only in live data mode with a real race id */
  enabled: boolean
  seedRacers?: LiveRacer[]
}

function assignMissingLanes(list: LiveRacer[]): LiveRacer[] {
  const used = new Set<number>()
  for (const r of list) {
    if (typeof r.lane === 'number' && r.lane > 0) used.add(r.lane)
  }
  let next = 1
  return list.map((r) => {
    if (typeof r.lane === 'number' && r.lane > 0) return r
    while (used.has(next)) next += 1
    const lane = next
    used.add(lane)
    next += 1
    return { ...r, lane }
  })
}

/**
 * Subscribe to Ably `race:{raceId}` / `race-update` for live pack progress.
 * progressMap is overall race 0–1 (`total_distance / (length*laps)`).
 * Never call setRacers on progress ticks — only mutate progressRef / laneRef.
 */
export function useLiveRace({ raceId, enabled, seedRacers = [] }: Options): LiveFeedState {
  const progressRef = useRef<Record<string, number>>({})
  const laneRef = useRef<Record<string, number>>({})
  const [feedConnected, setFeedConnected] = useState(false)
  const [isRacing, setIsRacing] = useState(false)
  const [status, setStatus] = useState<LiveFeedState['status']>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [racers, setRacers] = useState<LiveRacer[]>(() => assignMissingLanes(seedRacers))
  const subscribedId = useRef<string | null>(null)
  const seedKeyRef = useRef<string>('')

  const applyLaneProgressFromList = useCallback((list: LiveRacer[], writeProgress: boolean) => {
    for (const r of list) {
      if (writeProgress && typeof r.progress === 'number') {
        // Prefer progressMap for oval drive; racer.progress only as seed fallback
        if (progressRef.current[r.id] === undefined) {
          progressRef.current[r.id] = r.progress
        }
      }
      if (typeof r.lane === 'number' && r.lane > 0) {
        laneRef.current[r.id] = r.lane
      }
    }
  }, [])

  const commitRoster = useCallback(
    (list: LiveRacer[]) => {
      const withLanes = assignMissingLanes(list)
      for (let i = 0; i < withLanes.length; i++) {
        const r = withLanes[i]
        laneRef.current[r.id] = r.lane > 0 ? r.lane : i + 1
        if (!(r.id in progressRef.current)) {
          progressRef.current[r.id] = 0
        }
      }
      setRacers(withLanes)
    },
    [],
  )

  // Seed roster once per identity change (not every parent render)
  useEffect(() => {
    if (!seedRacers.length) return
    const key = seedRacers.map((r) => r.id).join(',')
    if (key === seedKeyRef.current && racers.length > 0) {
      // Keep lanes warm without React state churn
      applyLaneProgressFromList(assignMissingLanes(seedRacers), false)
      return
    }
    seedKeyRef.current = key
    commitRoster(seedRacers)
  }, [seedRacers, commitRoster, applyLaneProgressFromList, racers.length])

  useEffect(() => {
    if (!enabled || !raceId || !hasAblyKeyConfigured()) {
      setFeedConnected(false)
      setIsRacing(false)
      setStatus('idle')
      setElapsed(0)
      subscribedId.current = null
      return
    }

    const client = getAblyClient()
    if (!client) {
      setFeedConnected(false)
      return
    }

    let cancelled = false
    let channel: ReturnType<typeof getRaceChannel> | null = null

    const onMessage = (message: { data?: RaceUpdate }) => {
      const update = message.data
      if (!update || update.raceId !== raceId) return

      if (update.elapsed !== undefined) setElapsed(update.elapsed)

      // Always drive live oval from progressMap (overall 0–1)
      if (update.progressMap) {
        for (const [id, p] of Object.entries(update.progressMap)) {
          if (typeof p === 'number' && Number.isFinite(p)) {
            progressRef.current[id] = p
          }
        }
      }

      // Lane updates only — do NOT setRacers on progress ticks
      if (update.racers) {
        for (const r of update.racers) {
          if (typeof r.lane === 'number' && r.lane > 0) {
            laneRef.current[r.id] = r.lane
          }
        }
      }

      if (update.type === 'started') {
        // Snap overall progress to gate (0) then follow live
        if (update.racers?.length) {
          commitRoster(update.racers)
        } else if (update.progressMap) {
          for (const id of Object.keys(update.progressMap)) {
            progressRef.current[id] = 0
          }
        } else {
          for (const id of Object.keys(progressRef.current)) {
            progressRef.current[id] = 0
          }
        }
        if (update.racers) {
          applyLaneProgressFromList(update.racers, false)
        }
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'progress') {
        // Refs already updated — no setRacers
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'finished') {
        setIsRacing(false)
        setStatus('finished')
        if (update.results?.length) {
          commitRoster(update.results)
          for (const r of update.results) {
            progressRef.current[r.id] = 1
          }
        } else if (update.progressMap) {
          for (const id of Object.keys(update.progressMap)) {
            progressRef.current[id] = 1
          }
        }
      }
    }

    const setup = () => {
      if (cancelled) return
      try {
        channel = getRaceChannel(raceId)
        subscribedId.current = raceId
        channel.subscribe('race-update', onMessage)
        setFeedConnected(true)
        setIsRacing(false)
        setStatus((s) => (s === 'finished' ? s : 'waiting'))
        console.log(`[useLiveRace] subscribed race:${raceId}`)
      } catch (err) {
        console.warn('[useLiveRace] subscribe failed', err)
        setFeedConnected(false)
      }
    }

    const cleanup = () => {
      if (channel && subscribedId.current) {
        try {
          channel.unsubscribe('race-update')
        } catch {
          /* ignore */
        }
      }
      subscribedId.current = null
    }

    if (client.connection.state === 'connected') {
      setup()
    } else {
      const onConnect = () => {
        setup()
        client.connection.off('connected', onConnect)
      }
      client.connection.on('connected', onConnect)
      setup()
    }

    return () => {
      cancelled = true
      cleanup()
      setFeedConnected(false)
      setIsRacing(false)
    }
  }, [enabled, raceId, commitRoster, applyLaneProgressFromList])

  return {
    feedConnected,
    isRacing,
    status,
    elapsed,
    progressRef,
    laneRef,
    racers,
  }
}
