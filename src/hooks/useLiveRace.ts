import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import {
  ensureAblyConnected,
  getAblyClient,
  getRaceChannel,
  hasAblyKeyConfigured,
} from '../services/apiClient'
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
  /**
   * Finish order (racer ids) as horses cross the wire — mutated in place.
   * Once an id is appended it never moves; still-racing horses fill remaining places.
   */
  finishOrderRef: MutableRefObject<string[]>
  racers: LiveRacer[]
}

type Options = {
  raceId: string | null | undefined
  /** Subscribe only in live data mode with a real race id */
  enabled: boolean
  seedRacers?: LiveRacer[]
  /** Scheduled start ms — used to decide mid-race snapshot vs clean early attach */
  raceStartTime?: number | null
  /** Fired when Ably delivers finished so season can advance immediately */
  onRaceFinished?: (raceId: string, resultIds: string[]) => void
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

function rosterIdsKey(list: LiveRacer[]): string {
  return list.map((r) => r.id).join(',')
}

/**
 * Record finishers from progressMap / racer status without reshuffling earlier finishers.
 */
function noteFinishers(
  finishOrder: string[],
  progressMap: Record<string, number> | undefined,
  racers: LiveRacer[] | undefined,
) {
  const seen = new Set(finishOrder)
  // Prefer explicit finished status order from payload
  if (racers?.length) {
    const sorted = [...racers].sort((a, b) => {
      const ta = typeof a.finishTime === 'number' ? a.finishTime : Number.POSITIVE_INFINITY
      const tb = typeof b.finishTime === 'number' ? b.finishTime : Number.POSITIVE_INFINITY
      return ta - tb
    })
    for (const r of sorted) {
      const done =
        r.status === 'finished' ||
        (typeof r.progress === 'number' && r.progress >= 1) ||
        (typeof progressMap?.[r.id] === 'number' && progressMap[r.id]! >= 1)
      if (done && !seen.has(r.id)) {
        finishOrder.push(r.id)
        seen.add(r.id)
      }
    }
  }
  if (progressMap) {
    // Stable append by progress arrival order among newly-finished ids
    for (const [id, p] of Object.entries(progressMap)) {
      if (typeof p === 'number' && p >= 1 && !seen.has(id)) {
        finishOrder.push(id)
        seen.add(id)
      }
    }
  }
}

/**
 * Subscribe to Ably `race:{raceId}` / `race-update` for live pack progress.
 * progressMap is overall race 0–1 (`total_distance / (length*laps)`).
 * Never call setRacers on progress ticks — only mutate progressRef / laneRef.
 *
 * Subscribe as soon as raceId is known (upcoming / countdown) — do not wait for started.
 */
export function useLiveRace({
  raceId,
  enabled,
  seedRacers = [],
  raceStartTime = null,
  onRaceFinished,
}: Options): LiveFeedState {
  const progressRef = useRef<Record<string, number>>({})
  const laneRef = useRef<Record<string, number>>({})
  const finishOrderRef = useRef<string[]>([])
  const [feedConnected, setFeedConnected] = useState(false)
  const [isRacing, setIsRacing] = useState(false)
  const [status, setStatus] = useState<LiveFeedState['status']>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [racers, setRacers] = useState<LiveRacer[]>(() => assignMissingLanes(seedRacers))
  const subscribedId = useRef<string | null>(null)
  const seedKeyRef = useRef<string>('')
  const raceIdRef = useRef<string | null>(null)
  const lastElapsedRef = useRef(-1)
  const liveSyncedRef = useRef(false)
  const coalescingRef = useRef(false)
  const coalesceBufRef = useRef<RaceUpdate[]>([])
  const coalesceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onFinishedRef = useRef(onRaceFinished)
  onFinishedRef.current = onRaceFinished

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

  const commitRoster = useCallback((list: LiveRacer[]) => {
    const withLanes = assignMissingLanes(list)
    for (let i = 0; i < withLanes.length; i++) {
      const r = withLanes[i]
      laneRef.current[r.id] = r.lane > 0 ? r.lane : i + 1
      if (!(r.id in progressRef.current)) {
        progressRef.current[r.id] = 0
      }
    }
    setRacers(withLanes)
  }, [])

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

  // Reset finish book when race identity changes
  useEffect(() => {
    if (raceId !== raceIdRef.current) {
      raceIdRef.current = raceId ?? null
      finishOrderRef.current = []
      lastElapsedRef.current = -1
      liveSyncedRef.current = false
      for (const id of Object.keys(progressRef.current)) {
        progressRef.current[id] = 0
      }
    }
  }, [raceId])

  useEffect(() => {
    if (!enabled || !raceId || !hasAblyKeyConfigured()) {
      setFeedConnected(false)
      setIsRacing(false)
      setStatus('idle')
      setElapsed(0)
      subscribedId.current = null
      liveSyncedRef.current = false
      return
    }

    // Warm connection immediately (before Race canvas mounts)
    ensureAblyConnected()
    const client = getAblyClient()
    if (!client) {
      setFeedConnected(false)
      return
    }

    let cancelled = false
    let channel: ReturnType<typeof getRaceChannel> | null = null
    let attachedListener: ((stateChange: { hasBacklog?: boolean; resumed?: boolean }) => void) | null = null
    const expectedRaceId = raceId

    const applyUpdate = (update: RaceUpdate) => {
      if (!update || update.raceId !== expectedRaceId) return

      if (typeof update.elapsed === 'number' && Number.isFinite(update.elapsed)) {
        // Drop stale rewind/resume packets once we are live-synced forward
        if (liveSyncedRef.current && update.elapsed + 80 < lastElapsedRef.current) {
          return
        }
        if (update.elapsed >= lastElapsedRef.current) {
          lastElapsedRef.current = update.elapsed
        }
        setElapsed(update.elapsed)
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
        // Gate first: zero progress before any live follow so we never catch up from a queued burst
        finishOrderRef.current = []
        const ids =
          update.racers?.map((r) => r.id) ??
          (update.progressMap ? Object.keys(update.progressMap) : Object.keys(progressRef.current))
        for (const id of ids) {
          progressRef.current[id] = 0
        }
        // Only rebuild React roster when the field identity changes (avoids gate rebuild → snap)
        if (update.racers?.length) {
          const nextKey = rosterIdsKey(update.racers)
          if (nextKey !== seedKeyRef.current) {
            seedKeyRef.current = nextKey
            commitRoster(update.racers)
          } else {
            applyLaneProgressFromList(update.racers, false)
          }
        }
        // Apply started progressMap only when values are still at/near gate (avoid late "started" burst)
        if (update.progressMap) {
          for (const [id, p] of Object.entries(update.progressMap)) {
            if (typeof p === 'number' && Number.isFinite(p) && p > 0 && p < 0.02) {
              progressRef.current[id] = p
            }
          }
        }
        liveSyncedRef.current = true
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'progress') {
        // Apply progress immediately — RaceScene interpolates from gate; do not batch-skip
        if (update.progressMap) {
          for (const [id, p] of Object.entries(update.progressMap)) {
            if (typeof p === 'number' && Number.isFinite(p)) {
              progressRef.current[id] = p
            }
          }
        }
        noteFinishers(finishOrderRef.current, update.progressMap, update.racers)
        liveSyncedRef.current = true
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'finished') {
        if (update.progressMap) {
          for (const [id, p] of Object.entries(update.progressMap)) {
            if (typeof p === 'number' && Number.isFinite(p)) {
              progressRef.current[id] = p
            }
          }
        }
        if (update.results?.length) {
          // Official order wins
          finishOrderRef.current = update.results.map((r) => r.id)
          const withLanes = assignMissingLanes(update.results)
          const nextKey = rosterIdsKey(withLanes)
          if (nextKey !== seedKeyRef.current) {
            seedKeyRef.current = nextKey
            commitRoster(withLanes)
          } else {
            applyLaneProgressFromList(withLanes, false)
          }
          for (const r of update.results) {
            progressRef.current[r.id] = 1
          }
        } else {
          noteFinishers(finishOrderRef.current, update.progressMap, update.racers)
          if (update.progressMap) {
            for (const id of Object.keys(update.progressMap)) {
              progressRef.current[id] = Math.max(progressRef.current[id] ?? 0, 1)
            }
          }
        }
        liveSyncedRef.current = true
        setIsRacing(false)
        setStatus('finished')
        setFeedConnected(true)
        const resultIds =
          update.results?.map((r) => r.id) ??
          (finishOrderRef.current.length ? [...finishOrderRef.current] : [])
        onFinishedRef.current?.(expectedRaceId, resultIds)
      } else if (update.progressMap) {
        // Unknown type with progress — still apply so we never drop ticks
        for (const [id, p] of Object.entries(update.progressMap)) {
          if (typeof p === 'number' && Number.isFinite(p)) {
            progressRef.current[id] = p
          }
        }
        noteFinishers(finishOrderRef.current, update.progressMap, update.racers)
        liveSyncedRef.current = true
      }
    }

    const flushCoalesce = () => {
      coalesceTimerRef.current = null
      coalescingRef.current = false
      const buf = coalesceBufRef.current
      coalesceBufRef.current = []
      if (!buf.length) {
        liveSyncedRef.current = true
        return
      }
      // Time-order then collapse: honor started, then latest progress/finished by elapsed
      buf.sort((a, b) => (a.elapsed ?? a.timestamp ?? 0) - (b.elapsed ?? b.timestamp ?? 0))
      const started = buf.find((u) => u.type === 'started')
      const finished = [...buf].reverse().find((u) => u.type === 'finished')
      const latestLive = [...buf].reverse().find((u) => u.type === 'progress' || !!u.progressMap)
      if (started) applyUpdate(started)
      if (finished) applyUpdate(finished)
      else if (latestLive && latestLive !== started) applyUpdate(latestLive)
      liveSyncedRef.current = true
    }

    const onMessage = (message: { data?: RaceUpdate }) => {
      const update = message.data
      if (!update || update.raceId !== expectedRaceId) return

      // Attach backlog / resume flood — coalesce briefly, then apply latest (keep UX smooth)
      if (coalescingRef.current) {
        coalesceBufRef.current.push(update)
        if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current)
        coalesceTimerRef.current = setTimeout(flushCoalesce, 40)
        return
      }

      applyUpdate(update)
    }

    const setup = () => {
      if (cancelled) return
      try {
        const startMs = typeof raceStartTime === 'number' ? raceStartTime : null
        // Mid-race join only: one last message — never rewind multi-second progress floods
        const midRace = startMs != null && Date.now() >= startMs + 1500
        channel = getRaceChannel(expectedRaceId, { midRaceSnapshot: midRace })
        subscribedId.current = expectedRaceId
        liveSyncedRef.current = false
        lastElapsedRef.current = -1
        coalesceBufRef.current = []

        attachedListener = (stateChange) => {
          if (cancelled) return
          if (stateChange?.hasBacklog || stateChange?.resumed) {
            coalescingRef.current = true
            if (coalesceTimerRef.current) clearTimeout(coalesceTimerRef.current)
            // If no backlog messages arrive, clear coalescing shortly
            coalesceTimerRef.current = setTimeout(flushCoalesce, 80)
          } else {
            // Clean attach (typical early subscribe before start) — apply ticks immediately
            coalescingRef.current = false
            liveSyncedRef.current = false
          }
        }
        channel.on('attached', attachedListener)

        channel.subscribe('race-update', onMessage)
        setFeedConnected(true)
        setIsRacing(false)
        setStatus((s) => (s === 'finished' ? s : 'waiting'))
        console.log(
          `[useLiveRace] subscribed race:${expectedRaceId}${midRace ? ' (mid-race snapshot)' : ' (early)'}`,
        )
      } catch (err) {
        console.warn('[useLiveRace] subscribe failed', err)
        setFeedConnected(false)
      }
    }

    const cleanup = () => {
      if (coalesceTimerRef.current) {
        clearTimeout(coalesceTimerRef.current)
        coalesceTimerRef.current = null
      }
      coalesceBufRef.current = []
      coalescingRef.current = false
      if (channel && subscribedId.current) {
        try {
          channel.unsubscribe('race-update')
          if (attachedListener) channel.off('attached', attachedListener)
        } catch {
          /* ignore */
        }
        try {
          void channel.detach()
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
        if (!cancelled) setup()
        client.connection.off('connected', onConnect)
      }
      client.connection.on('connected', onConnect)
      // Also try immediately — Ably queues attach until connected
      setup()
    }

    return () => {
      cancelled = true
      cleanup()
      setFeedConnected(false)
      setIsRacing(false)
    }
  }, [enabled, raceId, raceStartTime, commitRoster, applyLaneProgressFromList])

  return {
    feedConnected,
    isRacing,
    status,
    elapsed,
    progressRef,
    laneRef,
    finishOrderRef,
    racers,
  }
}
