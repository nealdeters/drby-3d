import { useMemo } from 'react'
import { TvLowerThirds } from '../components/tv/TvLowerThirds'
import { TvScene } from '../components/tv/TvScene'
import { useLiveData } from '../context/LiveDataContext'
import { mapLiveRacerToHorse } from '../hooks/useLiveSeason'
import './TvView.css'

export function TvView() {
  const season = useLiveData()
  const feed = season.raceFeed
  const seedRacers = useMemo(() => {
    if (!season.currentRace || !season.roster.length) return season.roster
    const ids = new Set(season.currentRace.racerIds)
    const field = season.roster.filter((r) => ids.has(r.id))
    return field.length ? field : season.roster
  }, [season.currentRace, season.roster])

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

  const trackName =
    season.currentRace?.track?.name ??
    (currentEntry ? season.trackById(currentEntry.trackId)?.name : undefined)

  const trackLaps = season.currentRace?.track?.laps ?? 1
  const liveFeed = season.mode === 'live'

  return (
    <div className="tv-view">
      <div className="tv-view__canvas">
        <TvScene
          horses={horses}
          liveFeed={liveFeed}
          isRacing={feed.isRacing}
          trackLaps={trackLaps}
          progressRef={feed.progressRef}
          laneRef={feed.laneRef}
          raceId={season.currentRace?.id ?? null}
        />
      </div>
      <TvLowerThirds
        horses={horses}
        isRacing={feed.isRacing}
        live={liveFeed}
        elapsedMs={feed.elapsed}
        trackName={trackName}
        progressRef={feed.progressRef}
      />
    </div>
  )
}
