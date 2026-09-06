import { useMemo } from 'react'
import { RaceHUD } from '../components/race/RaceHUD'
import { RaceScene } from '../components/race/RaceScene'
import { useLiveData } from '../context/LiveDataContext'
import { useLiveRace } from '../hooks/useLiveRace'
import { mapLiveRacerToHorse } from '../hooks/useLiveSeason'
import type { RaceEntry } from '../data/fakeSeason'
import './RaceView.css'

export function RaceView() {
  const season = useLiveData()
  const raceId = season.currentRace?.id ?? null
  const seedRacers = useMemo(() => {
    if (!season.currentRace || !season.roster.length) return season.roster
    const ids = new Set(season.currentRace.racerIds)
    const field = season.roster.filter((r) => ids.has(r.id))
    return field.length ? field : season.roster
  }, [season.currentRace, season.roster])

  const feed = useLiveRace({
    raceId,
    enabled: season.mode === 'live' && Boolean(raceId),
    seedRacers,
  })

  const horses = useMemo(() => {
    if (season.mode === 'live' && (feed.racers.length || seedRacers.length)) {
      const list = feed.racers.length ? feed.racers : seedRacers
      return list.map(mapLiveRacerToHorse)
    }
    return season.horses
  }, [season.mode, season.horses, feed.racers, seedRacers])

  const currentEntry =
    season.races.find((r) => r.id === season.currentRace?.id) ??
    season.races.find((r) => r.status === 'live') ??
    null

  // Match live App: first schedule item with !completed && startTime > now
  const countdownTarget = useMemo((): RaceEntry | null => {
    const now = Date.now()
    const future = season.schedule.find((r) => !r.completed && r.startTime > now)
    if (!future) {
      return (
        season.races.find((r) => r.status === 'upcoming' && r.id !== currentEntry?.id) ?? null
      )
    }
    const mapped = season.races.find((r) => r.id === future.id)
    if (mapped) return mapped
    return {
      id: future.id,
      name: future.track?.name ? future.track.name : `Race ${future.id.slice(0, 8)}`,
      trackId: future.track?.id ?? 'unknown',
      scheduledAt: new Date(future.startTime).toISOString(),
      purse: 0,
      status: 'upcoming',
      horseIds: future.racerIds ?? [],
    }
  }, [season.schedule, season.races, currentEntry])

  const trackName =
    season.currentRace?.track?.name ??
    (currentEntry ? season.trackById(currentEntry.trackId)?.name : undefined)

  const trackLaps = season.currentRace?.track?.laps ?? 1

  /** Resolve racing-strip surface from live race track first, then catalogs — never drop asphalt. */
  const trackSurface = useMemo(() => {
    const normalize = (raw: unknown): 'asphalt' | 'turf' | 'dirt' | null => {
      if (raw == null) return null
      const s = String(raw).trim().toLowerCase()
      if (!s) return null
      if (s === 'asphalt' || s === 'tarmac' || s === 'pavement' || s === 'road') return 'asphalt'
      if (s === 'grass' || s === 'turf') return 'turf'
      if (s === 'dirt' || s === 'sand' || s === 'mud') return 'dirt'
      return null
    }

    const trackId =
      season.currentRace?.track?.id ??
      currentEntry?.trackId ??
      null

    const candidates: unknown[] = [
      season.currentRace?.track?.surface,
      // Live catalog by id (authoritative when schedule embed is incomplete)
      trackId
        ? season.liveTracks.find((t) => t.id === trackId)?.surface
        : undefined,
      // Schedule embed for this race id
      season.currentRace?.id
        ? season.schedule.find((e) => e.id === season.currentRace?.id)?.track?.surface
        : undefined,
      trackId ? season.schedule.find((e) => e.track?.id === trackId)?.track?.surface : undefined,
      // Mapped season tracks (live-mapped, not fake-only when live ids present)
      trackId ? season.trackById(trackId)?.surface : undefined,
      currentEntry ? season.trackById(currentEntry.trackId)?.surface : undefined,
    ]

    for (const c of candidates) {
      const n = normalize(c)
      if (n) return n
    }

    // Last resort by track name when surface embed is missing
    const nameHint = (
      season.currentRace?.track?.name ??
      (trackId ? season.liveTracks.find((t) => t.id === trackId)?.name : undefined) ??
      (trackId ? season.trackById(trackId)?.name : undefined) ??
      (currentEntry ? season.trackById(currentEntry.trackId)?.name : undefined) ??
      ''
    )
      .toLowerCase()
      .trim()
    if (nameHint.includes('oval circuit')) {
      return 'asphalt' as const
    }
    if (nameHint.includes('dirt derby')) {
      return 'dirt' as const
    }
    if (nameHint.includes('grassland')) {
      return 'turf' as const
    }

    return 'dirt' as const
  }, [
    season.currentRace,
    season.liveTracks,
    season.schedule,
    season.trackById,
    currentEntry,
  ])

  // Live-driven in live mode (subscribed or waiting) — isRacing chooses gate-hold vs progressMap
  // Never fall back to demo stepField between races while in live mode
  const liveFeed = season.mode === 'live'

  return (
    <div className="race-view">
      <div className="race-view__canvas">
        <RaceScene
          horses={horses}
          liveFeed={liveFeed}
          isRacing={feed.isRacing}
          trackLaps={trackLaps}
          surface={trackSurface}
          progressRef={feed.progressRef}
          laneRef={feed.laneRef}
        />
      </div>
      <RaceHUD
        mode={season.mode}
        feedConnected={feed.feedConnected}
        isRacing={feed.isRacing}
        elapsedMs={feed.elapsed}
        horses={horses}
        races={season.races}
        currentRace={currentEntry}
        nextRace={countdownTarget}
        trackName={trackName}
        trackSurface={trackSurface}
        progressRef={feed.progressRef}
      />
    </div>
  )
}
