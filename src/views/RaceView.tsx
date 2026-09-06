import { useMemo } from 'react'
import { RaceHUD } from '../components/race/RaceHUD'
import { RaceScene } from '../components/race/RaceScene'
import { useLiveData } from '../context/LiveDataContext'
import { useLiveRace } from '../hooks/useLiveRace'
import { mapLiveRacerToHorse } from '../hooks/useLiveSeason'
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

  const nextRaceEntry = useMemo(() => {
    if (season.nextRace) {
      const match = season.races.find((r) => r.id === season.nextRace!.id)
      if (match && match.id !== currentEntry?.id) return match
      const idx = season.races.findIndex((r) => r.id === season.nextRace!.id)
      const after = season.races.slice(idx + 1).find((r) => r.status === 'upcoming')
      return after ?? null
    }
    return season.races.find((r) => r.status === 'upcoming' && r.id !== currentEntry?.id) ?? null
  }, [season.nextRace, season.races, currentEntry])

  const trackName =
    season.currentRace?.track?.name ??
    (currentEntry ? season.trackById(currentEntry.trackId)?.name : undefined)

  const liveFeed = season.mode === 'live' && feed.feedConnected

  return (
    <div className="race-view">
      <div className="race-view__canvas">
        <RaceScene
          horses={horses}
          liveFeed={liveFeed}
          progressRef={feed.progressRef}
          laneRef={feed.laneRef}
        />
      </div>
      <RaceHUD
        mode={season.mode}
        feedConnected={feed.feedConnected}
        isRacing={feed.isRacing}
        horses={horses}
        races={season.races}
        currentRace={currentEntry}
        nextRace={nextRaceEntry}
        trackName={trackName}
      />
    </div>
  )
}
