import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useLiveRace, type LiveFeedState } from '../hooks/useLiveRace'
import { useLiveSeason, type LiveSeasonState } from '../hooks/useLiveSeason'

export type LiveDataValue = LiveSeasonState & {
  /** App-level Ably race feed — subscribed as soon as upcoming raceId is known */
  raceFeed: LiveFeedState
}

const LiveDataContext = createContext<LiveDataValue | null>(null)

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const season = useLiveSeason()

  const seedRacers = useMemo(() => {
    if (!season.currentRace || !season.roster.length) return season.roster
    const ids = new Set(season.currentRace.racerIds)
    const field = season.roster.filter((r) => ids.has(r.id))
    return field.length ? field : season.roster
  }, [season.currentRace, season.roster])

  const onRaceFinished = useCallback(
    (raceId: string, resultIds: string[]) => {
      season.markRaceCompleted(raceId, resultIds)
    },
    [season.markRaceCompleted],
  )

  // Subscribe early (2D pattern): as soon as next incomplete raceId exists in live mode,
  // attach to race:{id} during countdown — do not wait for Race view or started.
  const raceFeed = useLiveRace({
    raceId: season.currentRace?.id ?? null,
    enabled: season.mode === 'live' && Boolean(season.currentRace?.id),
    seedRacers,
    raceStartTime: season.currentRace?.startTime ?? null,
    onRaceFinished,
  })

  const value = useMemo<LiveDataValue>(
    () => ({
      ...season,
      raceFeed,
    }),
    [season, raceFeed],
  )

  return <LiveDataContext.Provider value={value}>{children}</LiveDataContext.Provider>
}

export function useLiveData(): LiveDataValue {
  const ctx = useContext(LiveDataContext)
  if (!ctx) throw new Error('useLiveData must be used within LiveDataProvider')
  return ctx
}
