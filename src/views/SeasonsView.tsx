import { useEffect, useMemo, useState } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { buildStandings } from '../hooks/useLiveSeason'
import { emitHashChange } from '../hooks/useView'
import type { LiveCompletedSeason, LiveRaceEvent } from '../types/live'

function readSeasonHash(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'seasons' && parts[1]) return decodeURIComponent(parts[1])
  return null
}

function writeSeasonHash(id: string | null) {
  const hash = id ? `#/seasons/${encodeURIComponent(id)}` : '#/seasons'
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
    emitHashChange()
  }
}

function placeLabel(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

function seasonKey(s: { id?: string; number?: number; status?: string }, fallback: string): string {
  if (s.id) return s.id
  if (typeof s.number === 'number') return `season-${s.number}`
  return fallback
}

export function SeasonsView() {
  const { mode, seasons, completedSeasons, loading, roster, horseById, standings, schedule, seasonNumber } =
    useLiveData()
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    typeof window !== 'undefined' ? readSeasonHash() : null,
  )
  const [showAllRaces, setShowAllRaces] = useState(false)

  useEffect(() => {
    const onPop = () => setSelectedKey(readSeasonHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    window.addEventListener('drby-hash', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
      window.removeEventListener('drby-hash', onPop)
    }
  }, [])

  const openSeason = (key: string) => {
    setSelectedKey(key)
    writeSeasonHash(key)
  }

  const closeSeason = () => {
    setSelectedKey(null)
    writeSeasonHash(null)
  }

  const selectedCompleted: LiveCompletedSeason | null = useMemo(() => {
    if (!selectedKey) return null
    return (
      completedSeasons.find((s) => s.id === selectedKey) ??
      completedSeasons.find((s) => `season-${s.number}` === selectedKey) ??
      completedSeasons.find((s) => String(s.number) === selectedKey) ??
      null
    )
  }, [completedSeasons, selectedKey])

  const isCurrent =
    !!selectedKey &&
    (selectedKey === `s-current-${seasonNumber}` ||
      selectedKey === `season-${seasonNumber}` ||
      selectedKey === String(seasonNumber)) &&
    !selectedCompleted

  const selectedRows = useMemo(() => {
    if (selectedCompleted) {
      const races = (selectedCompleted.races ?? []) as LiveRaceEvent[]
      const apiPts = selectedCompleted.finalStandings ?? {}
      return buildStandings(apiPts, roster, races)
    }
    if (isCurrent) return standings
    return []
  }, [selectedCompleted, isCurrent, roster, standings])

  const selectedRaces: LiveRaceEvent[] = useMemo(() => {
    if (selectedCompleted?.races?.length) {
      return [...selectedCompleted.races].sort((a, b) => (a.startTime ?? 0) - (b.startTime ?? 0))
    }
    if (isCurrent) return schedule
    return []
  }, [selectedCompleted, isCurrent, schedule])

  const raceResults = useMemo(
    () => selectedRaces.filter((r) => r.completed && r.results && r.results.length > 0),
    [selectedRaces],
  )
  const visibleRaces = useMemo(() => {
    if (showAllRaces || raceResults.length <= 80) return raceResults
    return raceResults.slice(-80)
  }, [raceResults, showAllRaces])

  const nameOf = (id: string) => {
    const h = horseById(id)
    if (h) return `${h.number}. ${h.name}`
    const r = roster.find((x) => x.id === id)
    return r ? r.name : id
  }

  const title = selectedCompleted
    ? `DRBY Season ${selectedCompleted.number}`
    : isCurrent
      ? `DRBY Season ${seasonNumber}`
      : null

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Campaigns</span>
          <h1>Seasons</h1>
          <p>Past, present, and upcoming DRBY circuits — open a meet for final places and race results.</p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? 'Live API' : 'Demo'}
        </span>
      </header>

      {loading && <p className="muted">Loading seasons…</p>}

      {!selectedKey && (
        <div className="grid-cards">
          {seasons.map((s) => {
            const key = seasonKey(s, s.name)
            const archived = completedSeasons.find((c) => c.id === s.id || c.number === Number(s.name.replace(/\D/g, '')))
            const winnerId = archived?.winner?.id
            const winnerName = winnerId ? nameOf(winnerId) : archived?.winner?.name
            return (
              <button
                key={s.id}
                type="button"
                className="card card-button"
                onClick={() => openSeason(key)}
              >
                <span
                  className="badge"
                  data-status={s.status === 'active' ? 'live' : s.status === 'upcoming' ? 'upcoming' : 'final'}
                >
                  {s.status}
                </span>
                <h3 style={{ marginTop: '0.75rem' }}>{s.name}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {s.year} · {s.raceCount} races
                </p>
                {winnerName && (
                  <p style={{ margin: '0.65rem 0 0' }}>
                    Champion <strong>{winnerName}</strong>
                    {typeof archived?.winner?.points === 'number' ? ` · ${archived.winner.points} pts` : ''}
                  </p>
                )}
                <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                  Open results
                </p>
              </button>
            )
          })}
        </div>
      )}

      {selectedKey && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <span className="view-kicker">{isCurrent ? 'Current' : 'Final'}</span>
              <h2 style={{ margin: 0 }}>{title ?? 'Season'}</h2>
            </div>
            <button type="button" className="btn" onClick={closeSeason}>
              All seasons
            </button>
          </div>
          <div className="panel-body">
            {selectedCompleted?.winner && (
              <p style={{ marginTop: 0 }}>
                Champion{' '}
                <strong>{nameOf(selectedCompleted.winner.id) || selectedCompleted.winner.name}</strong>
                {typeof selectedCompleted.winner.points === 'number'
                  ? ` · ${selectedCompleted.winner.points} pts`
                  : ''}
              </p>
            )}

            <h3 style={{ marginBottom: '0.5rem' }}>Championship table</h3>
            {selectedRows.length === 0 ? (
              <p className="muted">No standings stored for this season.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Horse</th>
                      <th>Pts</th>
                      <th>W</th>
                      <th>P</th>
                      <th>S</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedRows.map((row) => {
                      const horse = horseById(row.horseId)
                      const r = roster.find((x) => x.id === row.horseId)
                      return (
                        <tr key={row.horseId}>
                          <td>
                            <strong>{row.rank}</strong>
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 10,
                                height: 10,
                                borderRadius: 2,
                                background: horse?.jersey ?? r?.color ?? '#888',
                                marginRight: 8,
                                verticalAlign: 'middle',
                              }}
                            />
                            <strong>{horse ? `${horse.number}. ${horse.name}` : r?.name ?? row.horseId}</strong>
                          </td>
                          <td>{row.points}</td>
                          <td>{row.wins}</td>
                          <td>{row.places ?? 0}</td>
                          <td>{row.starts}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ margin: '1.25rem 0 0.5rem' }}>Race results</h3>
            {raceResults.length === 0 ? (
              <p className="muted">
                {isCurrent
                  ? 'No completed starts with a finish order yet this season.'
                  : 'No per-race finish order stored for this season.'}
              </p>
            ) : (
              <div className="season-results">
                <p className="muted" style={{ marginTop: 0 }}>
                  {showAllRaces || raceResults.length <= 80
                    ? `${raceResults.length} races with a finish order`
                    : `Latest 80 of ${raceResults.length} races with a finish order`}
                  {selectedRaces.length > raceResults.length
                    ? ` · ${selectedRaces.length - raceResults.length} washed / no result`
                    : ''}
                </p>
                {raceResults.length > 80 && (
                  <button
                    type="button"
                    className="btn"
                    style={{ marginBottom: '0.75rem' }}
                    onClick={() => setShowAllRaces((v) => !v)}
                  >
                    {showAllRaces ? 'Show latest 80' : 'Show all races'}
                  </button>
                )}
                {visibleRaces.map((race) => (
                  <div key={race.id} className="season-race-row">
                    <div>
                      <strong>{race.track?.name ?? race.id}</strong>
                      <div className="muted">
                        {race.startTime
                          ? new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            }).format(new Date(race.startTime))
                          : race.id}
                      </div>
                    </div>
                    <ol className="season-finish">
                      {(race.results ?? []).map((id, i) => (
                        <li key={`${race.id}-${id}-${i}`}>
                          <span className="muted">{placeLabel(i + 1)}</span> {nameOf(id)}
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
