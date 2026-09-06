import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  HORSES,
  RACES,
  SEASONS,
  STANDINGS,
  TRACKS,
  type Horse,
  type RaceEntry,
  type Season,
  type StandingRow,
  type Track,
} from '../data/fakeSeason'
import { hasApiKeyConfigured } from '../services/apiClient'
import { racesService } from '../services/racesService'
import { tracksService } from '../services/tracksService'
import type {
  DataMode,
  LiveCompletedSeason,
  LiveRaceEvent,
  LiveRacer,
  LiveTrack,
} from '../types/live'

const COATS = [
  '#8a4f2a',
  '#1a1412',
  '#b08948',
  '#6b5238',
  '#9a3b1e',
  '#9aa0a8',
  '#4a3220',
  '#3d2a28',
]

function metersToFurlongs(meters: number): number {
  return Math.round((meters / 201.168) * 10) / 10
}

export function mapLiveRacerToHorse(r: LiveRacer, index: number): Horse {
  return {
    id: r.id,
    name: r.name,
    number: r.lane > 0 ? r.lane : index + 1,
    jersey: r.color || '#c44536',
    coat: COATS[index % COATS.length],
    jockey: '—',
    speedBias: Math.max(0.9, Math.min(1.1, (r.baseSpeed || 80) / 80)),
  }
}

function mapLiveTrack(t: LiveTrack): Track {
  const surface = t.surface === 'grass' ? 'turf' : 'dirt'
  return {
    id: t.id,
    name: t.name,
    city: 'DRBY',
    surface,
    lengthFurlongs: metersToFurlongs(t.length) || 8,
    description: `${t.laps} lap${t.laps === 1 ? '' : 's'} · ${t.length}m · ${t.surface}`,
  }
}

function raceStatus(
  ev: LiveRaceEvent,
  now: number,
  liveRaceId: string | null,
): RaceEntry['status'] {
  if (ev.completed) return 'final'
  if (liveRaceId && ev.id === liveRaceId) return 'live'
  if (ev.startTime <= now) return 'live'
  return 'upcoming'
}

function mapRaceEvent(
  ev: LiveRaceEvent,
  now: number,
  liveRaceId: string | null,
): RaceEntry {
  return {
    id: ev.id,
    name: ev.track?.name ? `${ev.track.name}` : `Race ${ev.id.slice(0, 8)}`,
    trackId: ev.track?.id ?? 'unknown',
    scheduledAt: new Date(ev.startTime).toISOString(),
    purse: 0,
    status: raceStatus(ev, now, liveRaceId),
    horseIds: ev.racerIds ?? [],
  }
}

function buildStandings(
  points: Record<string, number>,
  roster: LiveRacer[],
  schedule: LiveRaceEvent[],
): StandingRow[] {
  const wins: Record<string, number> = {}
  const starts: Record<string, number> = {}
  for (const r of roster) {
    wins[r.id] = 0
    starts[r.id] = 0
  }
  for (const race of schedule) {
    if (!race.completed || !race.results?.length) continue
    for (const id of race.results) {
      starts[id] = (starts[id] ?? 0) + 1
    }
    const winner = race.results[0]
    if (winner) wins[winner] = (wins[winner] ?? 0) + 1
  }
  const ids = Object.keys(points).length
    ? Object.keys(points)
    : roster.map((r) => r.id)
  return ids
    .map((id) => ({
      horseId: id,
      points: points[id] ?? 0,
      wins: wins[id] ?? 0,
      starts: starts[id] ?? 0,
      rank: 0,
    }))
    .sort((a, b) => b.points - a.points || b.wins - a.wins)
    .map((row, i) => ({ ...row, rank: i + 1 }))
}

function buildSeasons(
  seasonNumber: number,
  completed: LiveCompletedSeason[],
  scheduleLen: number,
): Season[] {
  const seasons: Season[] = [
    {
      id: `s-current-${seasonNumber}`,
      name: `DRBY Season ${seasonNumber}`,
      year: new Date().getFullYear(),
      status: 'active',
      raceCount: scheduleLen,
    },
  ]
  for (const s of completed) {
    seasons.push({
      id: s.id || `s-${s.number}`,
      name: `DRBY Season ${s.number}`,
      year: s.completedAt ? new Date(s.completedAt).getFullYear() : new Date().getFullYear(),
      status: 'completed',
      raceCount: s.totalRaces ?? s.races?.length ?? 0,
    })
  }
  return seasons
}

export type LiveSeasonState = {
  mode: DataMode
  loading: boolean
  error: string | null
  horses: Horse[]
  roster: LiveRacer[]
  tracks: Track[]
  liveTracks: LiveTrack[]
  races: RaceEntry[]
  schedule: LiveRaceEvent[]
  standings: StandingRow[]
  seasons: Season[]
  nextRace: LiveRaceEvent | null
  currentRace: LiveRaceEvent | null
  seasonNumber: number
  horseById: (id: string) => Horse | undefined
  trackById: (id: string) => Track | undefined
  refresh: () => Promise<void>
}

function demoState(): Omit<LiveSeasonState, 'refresh' | 'loading' | 'error' | 'horseById' | 'trackById'> {
  return {
    mode: 'demo',
    horses: HORSES,
    roster: [],
    tracks: TRACKS,
    liveTracks: [],
    races: RACES,
    schedule: [],
    standings: STANDINGS,
    seasons: SEASONS,
    nextRace: null,
    currentRace: null,
    seasonNumber: 2026,
  }
}

export function useLiveSeason(): LiveSeasonState {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<DataMode>('demo')
  const [roster, setRoster] = useState<LiveRacer[]>([])
  const [liveTracks, setLiveTracks] = useState<LiveTrack[]>([])
  const [schedule, setSchedule] = useState<LiveRaceEvent[]>([])
  const [points, setPoints] = useState<Record<string, number>>({})
  const [completed, setCompleted] = useState<LiveCompletedSeason[]>([])
  const [seasonNumber, setSeasonNumber] = useState(1)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    // Prefer live when API base is reachable; empty API key may 401 → demo fallback
    try {
      const [fetchedRoster, fetchedTracks, fetchedSchedule, fetchedStandings, fetchedSeasons, fetchedNum] =
        await Promise.all([
          racesService.getRoster(),
          tracksService.getAll().catch(() => [] as LiveTrack[]),
          racesService.getSeasonSchedule(),
          racesService.getStandings().catch(() => ({}) as Record<string, number>),
          racesService.getCompletedSeasons().catch(() => [] as LiveCompletedSeason[]),
          racesService.getCurrentSeasonNumber().catch(() => 1),
        ])

      const rosterList = Array.isArray(fetchedRoster) ? fetchedRoster : []
      const scheduleList = Array.isArray(fetchedSchedule) ? fetchedSchedule : []
      if (rosterList.length === 0 && scheduleList.length === 0 && !hasApiKeyConfigured()) {
        // Empty live payload with no key — treat as unavailable
        setMode('demo')
        setRoster([])
        setLiveTracks([])
        setSchedule([])
        setPoints({})
        setCompleted([])
        setSeasonNumber(1)
        setError('Live API returned empty data (set VITE_API_KEY if required)')
      } else {
        setMode('live')
        setRoster(rosterList)
        setLiveTracks(Array.isArray(fetchedTracks) ? fetchedTracks : [])
        setSchedule(scheduleList)
        setPoints(fetchedStandings && typeof fetchedStandings === 'object' ? fetchedStandings : {})
        setCompleted(Array.isArray(fetchedSeasons) ? fetchedSeasons : [])
        setSeasonNumber(typeof fetchedNum === 'number' ? fetchedNum : 1)
      }
    } catch (err) {
      console.warn('[useLiveSeason] falling back to demo', err)
      setMode('demo')
      setRoster([])
      setLiveTracks([])
      setSchedule([])
      setPoints({})
      setCompleted([])
      setError(err instanceof Error ? err.message : 'Live API unavailable')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // Soft-refresh schedule/standings so next-race countdown advances after finishes
  const softRefresh = useCallback(async () => {
    try {
      const [fetchedSchedule, fetchedStandings, fetchedNum] = await Promise.all([
        racesService.getSeasonSchedule(),
        racesService.getStandings().catch(() => null),
        racesService.getCurrentSeasonNumber().catch(() => null),
      ])
      const scheduleList = Array.isArray(fetchedSchedule) ? fetchedSchedule : null
      if (scheduleList) {
        setSchedule(scheduleList)
      }
      if (fetchedStandings && typeof fetchedStandings === 'object') {
        setPoints(fetchedStandings)
      }
      if (typeof fetchedNum === 'number') setSeasonNumber(fetchedNum)
    } catch (err) {
      console.warn('[useLiveSeason] soft refresh failed', err)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'live') return
    const id = window.setInterval(() => {
      void softRefresh()
    }, 20_000)
    return () => window.clearInterval(id)
  }, [mode, softRefresh])

  const derived = useMemo(() => {
    if (mode === 'demo') {
      const d = demoState()
      return {
        ...d,
        horses: HORSES,
        races: RACES,
        tracks: TRACKS,
        standings: STANDINGS,
        seasons: SEASONS,
      }
    }

    const now = Date.now()
    const next = schedule.find((r) => !r.completed) ?? null
    // Current = next incomplete (may already be past startTime / in progress)
    const current = next
    const liveRaceId =
      current && current.startTime <= now && !current.completed ? current.id : null

    const horses =
      roster.length > 0
        ? roster.map(mapLiveRacerToHorse)
        : HORSES

    const tracks =
      liveTracks.length > 0
        ? liveTracks.map(mapLiveTrack)
        : // synthesize from schedule tracks
          Array.from(
            new Map(
              schedule
                .filter((e) => e.track)
                .map((e) => [e.track.id, mapLiveTrack(e.track)]),
            ).values(),
          )

    const races = schedule.map((e) => mapRaceEvent(e, now, liveRaceId))
    const standings = buildStandings(points, roster, schedule)
    const seasons = buildSeasons(seasonNumber, completed, schedule.length)

    return {
      mode: 'live' as const,
      horses,
      races,
      tracks: tracks.length ? tracks : TRACKS,
      standings: standings.length ? standings : STANDINGS,
      seasons,
      nextRace: next,
      currentRace: current,
      seasonNumber,
    }
  }, [mode, roster, liveTracks, schedule, points, completed, seasonNumber])

  const horseMap = useMemo(() => {
    const m = new Map(derived.horses.map((h) => [h.id, h]))
    return m
  }, [derived.horses])

  const trackMap = useMemo(() => {
    const m = new Map(derived.tracks.map((t) => [t.id, t]))
    return m
  }, [derived.tracks])

  return {
    mode: derived.mode,
    loading,
    error,
    horses: derived.horses,
    roster,
    tracks: derived.tracks,
    liveTracks,
    races: derived.races,
    schedule,
    standings: derived.standings,
    seasons: derived.seasons,
    nextRace: derived.nextRace ?? null,
    currentRace: derived.currentRace ?? null,
    seasonNumber: derived.seasonNumber,
    horseById: (id: string) => horseMap.get(id),
    trackById: (id: string) => trackMap.get(id),
    refresh: load,
  }
}
