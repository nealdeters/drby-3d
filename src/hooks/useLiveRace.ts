import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { getAblyClient, getRaceChannel, hasAblyKeyConfigured } from '../services/apiClient'
import type { LiveRacer, RaceUpdate } from '../types/live'

export type LiveFeedState = {
  /** Ably key present and channel subscribed (or connected) */
  feedConnected: boolean
  isRacing: boolean
  status: 'idle' | 'waiting' | 'racing' | 'finished'
  elapsed: number
  /** Lap / race progress 0–1 per racer — mutated in place for R3F */
  progressRef: MutableRefObject<Record<string, number>>
  /** Lane 1–8 per racer */
  laneRef: MutableRefObject<Record<string, number>>
  racers: LiveRacer[]
}

type Options = {
  raceId: string | null | undefined
  /** Subscribe only in live data mode with a real race id */
  enabled: boolean
  seedRacers?: LiveRacer[]
}

/**
 * Subscribe to Ably `race:{raceId}` / `race-update` for live pack progress.
 * progressMap is overall race 0–1; prefer racer.progress (lap fraction) for oval placement.
 */
export function useLiveRace({ raceId, enabled, seedRacers = [] }: Options): LiveFeedState {
  const progressRef = useRef<Record<string, number>>({})
  const laneRef = useRef<Record<string, number>>({})
  const [feedConnected, setFeedConnected] = useState(false)
  const [isRacing, setIsRacing] = useState(false)
  const [status, setStatus] = useState<LiveFeedState['status']>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [racers, setRacers] = useState<LiveRacer[]>(seedRacers)
  const subscribedId = useRef<string | null>(null)

  const applyRacers = useCallback((list: LiveRacer[]) => {
    setRacers(list)
    for (const r of list) {
      if (typeof r.progress === 'number') {
        progressRef.current[r.id] = r.progress
      }
      if (typeof r.lane === 'number' && r.lane > 0) {
        laneRef.current[r.id] = r.lane
      }
    }
  }, [])

  useEffect(() => {
    // Seed lanes from roster when not racing yet
    if (seedRacers.length) {
      for (const r of seedRacers) {
        if (typeof r.lane === 'number' && r.lane > 0) {
          laneRef.current[r.id] = r.lane
        }
        if (!(r.id in progressRef.current)) {
          progressRef.current[r.id] = 0
        }
      }
    }
  }, [seedRacers])

  useEffect(() => {
    if (!enabled || !raceId || !hasAblyKeyConfigured()) {
      setFeedConnected(false)
      setIsRacing(false)
      setStatus('idle')
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

      if (update.progressMap) {
        for (const [id, p] of Object.entries(update.progressMap)) {
          // Overall race progress — keep for HUD; lap pos prefers racer.progress below
          if (typeof p === 'number') {
            // If no per-racer lap progress yet, approximate with overall
            if (progressRef.current[id] === undefined) {
              progressRef.current[id] = p
            }
          }
        }
      }

      if (update.racers) {
        for (const r of update.racers) {
          if (typeof r.progress === 'number') {
            progressRef.current[r.id] = r.progress
          }
          if (typeof r.lane === 'number') {
            laneRef.current[r.id] = r.lane
          }
        }
        applyRacers(update.racers)
      }

      if (update.type === 'started') {
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'progress') {
        setIsRacing(true)
        setStatus('racing')
        setFeedConnected(true)
      } else if (update.type === 'finished') {
        setIsRacing(false)
        setStatus('finished')
        if (update.results) applyRacers(update.results)
        // Snap finishers toward 1
        if (update.results) {
          for (const r of update.results) {
            progressRef.current[r.id] = 1
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
      // Also try immediately — Ably may already be connecting
      setup()
    }

    return () => {
      cancelled = true
      cleanup()
      setFeedConnected(false)
    }
  }, [enabled, raceId, applyRacers])

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
