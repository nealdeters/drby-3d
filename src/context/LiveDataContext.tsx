import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useLiveRace, type LiveFeedState } from '../hooks/useLiveRace'
import { useLiveSeason, type LiveSeasonState } from '../hooks/useLiveSeason'
import {
  PHOTO_FINISH_HOLD_MS,
  isPhotoFinishActive,
  type PhotoFinishHold,
} from '../lib/photoFinish'
import type { LiveRaceEvent } from '../types/live'

export type LiveDataValue = LiveSeasonState & {
  /** App-level Ably race feed — subscribed as soon as upcoming raceId is known */
  raceFeed: LiveFeedState
  /** Finished race pinned on the wire (and official board) until `until`. */
  photoFinish: PhotoFinishHold | null
  /** Race the canvas should show: photo-finish hold, else current card. */
  displayRace: LiveRaceEvent | null
}

const LiveDataContext = createContext<LiveDataValue | null>(null)

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const season = useLiveSeason()
  const [photoFinish, setPhotoFinish] = useState<PhotoFinishHold | null>(null)

  const hold = isPhotoFinishActive(photoFinish) ? photoFinish : null

  const displayRace = useMemo((): LiveRaceEvent | null => {
    if (hold) {
      return season.schedule.find((r) => r.id === hold.raceId) ?? season.currentRace
    }
    return season.currentRace
  }, [hold, season.schedule, season.currentRace])

  const seedRacers = useMemo(() => {
    if (!displayRace || !season.roster.length) return season.roster
    const ids = new Set(displayRace.racerIds)
    const field = season.roster.filter((r) => ids.has(r.id))
    return field.length ? field : season.roster
  }, [displayRace, season.roster])

  const onRaceFinished = useCallback(
    (raceId: string, resultIds: string[]) => {
      season.markRaceCompleted(raceId, resultIds)
      setPhotoFinish({
        raceId,
        resultIds,
        until: Date.now() + PHOTO_FINISH_HOLD_MS,
      })
    },
    [season.markRaceCompleted],
  )

  useEffect(() => {
    if (!photoFinish) return
    const delay = Math.max(0, photoFinish.until - Date.now())
    const id = window.setTimeout(() => {
      setPhotoFinish((cur) => (cur && cur.until <= Date.now() ? null : cur))
    }, delay)
    return () => window.clearTimeout(id)
  }, [photoFinish])

  // Subscribe early (2D pattern): as soon as next incomplete raceId exists in live mode,
  // attach to race:{id} during countdown — do not wait for Race view or started.
  // During photo-finish hold, stay on the finished race so the pack does not gate-warp.
  const raceFeed = useLiveRace({
    raceId: displayRace?.id ?? null,
    enabled: season.mode === 'live' && Boolean(displayRace?.id),
    seedRacers,
    raceStartTime: displayRace?.startTime ?? null,
    onRaceFinished,
  })

  const value = useMemo<LiveDataValue>(
    () => ({
      ...season,
      raceFeed,
      photoFinish: hold,
      displayRace,
    }),
    [season, raceFeed, hold, displayRace],
  )

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
}

export function useLiveData(): LiveDataValue {
  const ctx = useContext(LiveDataContext)
  if (!ctx) throw new Error('useLiveData must be used within LiveDataProvider')
  return ctx
}
