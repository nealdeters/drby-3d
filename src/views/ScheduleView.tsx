import { useEffect, useMemo, useState } from 'react'
import { formatPurse, formatWhen } from '../data/fakeSeason'
import { useLiveData } from '../context/LiveDataContext'
import { emitHashChange } from '../hooks/useView'
import type { LiveRaceEvent } from '../types/live'
import type { RaceEntry } from '../data/fakeSeason'

function readRaceHash(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [path, qs] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'schedule' && parts[1]) return decodeURIComponent(parts[1])
  if (qs) {
    const params = new URLSearchParams(qs)
    return params.get('race')
  }
  return null
}

function writeRaceHash(raceId: string | null) {
  const hash = raceId ? `#/schedule/${encodeURIComponent(raceId)}` : '#/schedule'
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
    emitHashChange()
  }
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

export function ScheduleView() {
  const { mode, races, schedule, trackById, horseById, roster, loading } = useLiveData()
  const [hideFinished, setHideFinished] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? readRaceHash() : null,
  )

  useEffect(() => {
    const onPop = () => setSelectedId(readRaceHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    window.addEventListener('drby-hash', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
      window.removeEventListener('drby-hash', onPop)
    }
  }, [])

  const visibleRaces = useMemo(() => {
    if (!hideFinished) return races
    return races.filter((r) => r.status !== 'final')
  }, [races, hideFinished])

  const liveById = useMemo(() => {
    const m = new Map<string, LiveRaceEvent>()
    for (const e of schedule) m.set(e.id, e)
    return m
  }, [schedule])

  const openRace = (id: string) => {
    setSelectedId(id)
    writeRaceHash(id)
  }

  const closeRace = () => {
    setSelectedId(null)
    writeRaceHash(null)
  }

  const selectedRace: RaceEntry | null = useMemo(
    () => races.find((r) => r.id === selectedId) ?? null,
    [races, selectedId],
  )
  const selectedLive = selectedId ? liveById.get(selectedId) : undefined
  const selectedTrack = selectedRace ? trackById(selectedRace.trackId) : undefined

  const fieldIds = useMemo(() => {
    if (selectedLive?.racerIds?.length) return selectedLive.racerIds
    return selectedRace?.horseIds ?? []
  }, [selectedLive, selectedRace])

  const resultsIds = useMemo(() => {
    if (selectedLive?.results?.length) return selectedLive.results
    return [] as string[]
  }, [selectedLive])

  const isCompleted =
    selectedRace?.status === 'final' || Boolean(selectedLive?.completed)

  const resolveName = (id: string, index: number) => {
    const horse = horseById(id)
    if (horse) return { name: horse.name, number: horse.number, color: horse.jersey }
    const r = roster.find((x) => x.id === id)
    if (r) return { name: r.name, number: r.lane || index + 1, color: r.color }
    return { name: id.slice(0, 8), number: index + 1, color: '#888' }
  }

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Official program</span>
          <h1>Race Schedule</h1>
          <p>Card of the day — purses, tracks, and post times for the DRBY season.</p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? 'Live API' : 'Demo data'}
        </span>
      </header>

      <div className="panel">
        <div className="panel-header" style={{ flexWrap: 'wrap' }}>
          <h2>{mode === 'live' ? 'Season card' : "Today's card"}</h2>
          <div className="schedule-toolbar">
            <label className="schedule-toggle">
              <input
                type="checkbox"
                checked={hideFinished}
                onChange={(e) => setHideFinished(e.target.checked)}
              />
              <span>Hide finished</span>
            </label>
            <span className="muted">
              {loading
                ? 'Loading…'
                : `${visibleRaces.length} shown${hideFinished ? ` · ${races.length - visibleRaces.length} hidden` : ''}`}
            </span>
          </div>
        </div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Race</th>
                <th>Track</th>
                <th>Purse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRaces.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    {hideFinished
                      ? 'No upcoming or live races — turn off “Hide finished” to see results.'
                      : 'No races on the card.'}
                  </td>
                </tr>
              ) : (
                visibleRaces.map((r) => {
                  const track = trackById(r.trackId)
                  return (
                    <tr
                      key={r.id}
                      className="table-row-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => openRace(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openRace(r.id)
                        }
                      }}
                    >
                      <td>{formatWhen(r.scheduledAt)}</td>
                      <td>
                        <strong>{r.name}</strong>
                      </td>
                      <td>{track?.name ?? r.trackId}</td>
                      <td>{r.purse > 0 ? formatPurse(r.purse) : '—'}</td>
                      <td>
                        <span className="badge" data-status={r.status}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRace && (
        <div className="modal-backdrop" role="presentation" onClick={closeRace}>
          <div
            className="modal-sheet panel"
            role="dialog"
            aria-modal="true"
            aria-label="Race detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <span className="view-kicker">{isCompleted ? 'Results' : 'Field'}</span>
                <h2 style={{ margin: 0 }}>{selectedRace.name}</h2>
                <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                  {selectedTrack?.name ?? selectedRace.trackId}
                  {' · '}
                  {formatWhen(selectedRace.scheduledAt)}
                  {selectedRace.purse > 0 ? ` · ${formatPurse(selectedRace.purse)}` : ''}
                </p>
              </div>
              <button type="button" className="btn" onClick={closeRace}>
                Close
              </button>
            </div>
            <div className="panel-body">
              <div style={{ marginBottom: '0.75rem' }}>
                <span className="badge" data-status={selectedRace.status}>
                  {selectedRace.status}
                </span>
              </div>

              {isCompleted ? (
                resultsIds.length > 0 ? (
                  <ol className="race-detail-list">
                    {resultsIds.map((id, i) => {
                      const info = resolveName(id, i)
                      return (
                        <li key={id}>
                          <span className="race-detail-place">{ordinal(i + 1)}</span>
                          <span
                            className="race-detail-num"
                            style={{ background: info.color }}
                          >
                            {info.number}
                          </span>
                          <strong>{info.name}</strong>
                        </li>
                      )
                    })}
                  </ol>
                ) : (
                  <p className="muted" style={{ margin: 0 }}>
                    Finish order is not available for this race yet.
                    {fieldIds.length > 0
                      ? ' Planned field is listed below for reference.'
                      : ''}
                  </p>
                )
              ) : null}

              {(!isCompleted || (isCompleted && resultsIds.length === 0)) && (
                <>
                  {!isCompleted && (
                    <div className="muted" style={{ marginBottom: '0.45rem' }}>
                      Planned field
                    </div>
                  )}
                  {fieldIds.length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      Field not posted yet.
                    </p>
                  ) : (
                    <ul className="race-detail-list" style={{ listStyle: 'none', padding: 0 }}>
                      {fieldIds.map((id, i) => {
                        const info = resolveName(id, i)
                        return (
                          <li key={id}>
                            <span className="race-detail-place">{i + 1}</span>
                            <span
                              className="race-detail-num"
                              style={{ background: info.color }}
                            >
                              {info.number}
                            </span>
                            <strong>{info.name}</strong>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
