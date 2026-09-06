import { useEffect, useMemo, useState } from 'react'
import { useLiveData } from '../context/LiveDataContext'
import { emitHashChange } from '../hooks/useView'
import type { LiveRacer } from '../types/live'

function readRacerHash(): string | null {
  const raw = window.location.hash.replace(/^#\/?/, '')
  // standings/racerId or standings?racer=id
  const [path, qs] = raw.split('?')
  const parts = path.split('/').filter(Boolean)
  if (parts[0] === 'standings' && parts[1]) return decodeURIComponent(parts[1])
  if (qs) {
    const params = new URLSearchParams(qs)
    return params.get('racer')
  }
  return null
}

function writeRacerHash(racerId: string | null) {
  const hash = racerId ? `#/standings/${encodeURIComponent(racerId)}` : '#/standings'
  if (window.location.hash !== hash) {
    window.history.pushState(null, '', hash)
    emitHashChange()
  }
}

function formatPct(n: number): string {
  if (!Number.isFinite(n)) return '—'
  return `${Math.round(n)}%`
}

function attrLabel(key: string): string {
  switch (key) {
    case 'baseSpeed':
      return 'Speed'
    case 'acceleration':
      return 'Accel'
    case 'endurance':
      return 'Endurance'
    case 'consistency':
      return 'Consistency'
    case 'staminaRecovery':
      return 'Recovery'
    default:
      return key
  }
}

export function StandingsView() {
  const { mode, standings, horseById, roster, schedule, seasonNumber, loading } = useLiveData()
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? readRacerHash() : null,
  )

  useEffect(() => {
    const onPop = () => setSelectedId(readRacerHash())
    window.addEventListener('popstate', onPop)
    window.addEventListener('hashchange', onPop)
    window.addEventListener('drby-hash', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('hashchange', onPop)
      window.removeEventListener('drby-hash', onPop)
    }
  }, [])

  const openRacer = (id: string) => {
    setSelectedId(id)
    writeRacerHash(id)
  }

  const closeRacer = () => {
    setSelectedId(null)
    writeRacerHash(null)
  }

  const selectedStanding = useMemo(
    () => standings.find((s) => s.horseId === selectedId) ?? null,
    [standings, selectedId],
  )
  const selectedHorse = selectedId ? horseById(selectedId) : undefined
  const selectedRoster: LiveRacer | undefined = useMemo(
    () => roster.find((r) => r.id === selectedId),
    [roster, selectedId],
  )

  const recentFinishes = useMemo(() => {
    if (!selectedId) return [] as Array<{ raceName: string; place: number; when: number }>
    const out: Array<{ raceName: string; place: number; when: number }> = []
    for (const race of schedule) {
      if (!race.completed || !race.results?.length) continue
      const idx = race.results.indexOf(selectedId)
      if (idx < 0) continue
      out.push({
        raceName: race.track?.name ? race.track.name : `Race ${race.id.slice(0, 8)}`,
        place: idx + 1,
        when: race.startTime,
      })
    }
    return out.sort((a, b) => b.when - a.when).slice(0, 8)
  }, [schedule, selectedId])

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Leaderboard</span>
          <h1>Standings</h1>
          <p>
            Points, wins, and starts across{' '}
            {mode === 'live' ? `DRBY Season ${seasonNumber}` : 'the DRBY 2026 campaign'}. Tap a
            horse for form, health, and recent finishes.
          </p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? `Season ${seasonNumber} · live` : 'DRBY 2026 · demo'}
        </span>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h2>Championship table</h2>
          <span className="muted">{loading ? 'Loading…' : `${standings.length} horses`}</span>
        </div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
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
              {standings.map((row) => {
                const horse = horseById(row.horseId)
                return (
                  <tr
                    key={row.horseId}
                    className="table-row-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => openRacer(row.horseId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        openRacer(row.horseId)
                      }
                    }}
                  >
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
                          background: horse?.jersey ?? '#888',
                          marginRight: 8,
                          verticalAlign: 'middle',
                        }}
                      />
                      <strong>
                        {horse ? `${horse.number}. ${horse.name}` : row.horseId}
                      </strong>
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
      </div>

      {selectedId && (
        <div className="modal-backdrop" role="presentation" onClick={closeRacer}>
          <div
            className="modal-sheet panel"
            role="dialog"
            aria-modal="true"
            aria-label="Racer detail"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="panel-header">
              <div>
                <span className="view-kicker">Racer</span>
                <h2 style={{ margin: 0 }}>
                  {selectedHorse
                    ? `${selectedHorse.number}. ${selectedHorse.name}`
                    : selectedRoster?.name ?? selectedId}
                </h2>
              </div>
              <button type="button" className="btn" onClick={closeRacer}>
                Close
              </button>
            </div>
            <div className="panel-body racer-detail">
              <div className="racer-detail__identity">
                <span
                  className="racer-detail__swatch"
                  style={{
                    background: selectedHorse?.jersey ?? selectedRoster?.color ?? '#888',
                  }}
                />
                <div>
                  <div className="muted">Silk / number</div>
                  <strong>
                    #{selectedHorse?.number ?? selectedRoster?.lane ?? '—'} ·{' '}
                    {selectedHorse?.jersey ?? selectedRoster?.color ?? '—'}
                  </strong>
                </div>
              </div>

              <div className="racer-detail__grid">
                <div>
                  <div className="muted">Season record</div>
                  <strong>
                    {selectedStanding
                      ? `${selectedStanding.wins}-${selectedStanding.places ?? 0}-${selectedStanding.starts}`
                      : '—'}
                  </strong>
                  <div className="muted" style={{ marginTop: 2 }}>
                    W–P–S
                  </div>
                </div>
                <div>
                  <div className="muted">Points</div>
                  <strong>{selectedStanding?.points ?? 0}</strong>
                </div>
                <div>
                  <div className="muted">Rank</div>
                  <strong>#{selectedStanding?.rank ?? '—'}</strong>
                </div>
                <div>
                  <div className="muted">Active health</div>
                  <strong>
                    {selectedRoster && typeof selectedRoster.health === 'number'
                      ? formatPct(selectedRoster.health)
                      : mode === 'live'
                        ? '—'
                        : '100%'}
                  </strong>
                </div>
              </div>

              {selectedRoster && (
                <>
                  <div className="racer-detail__section">
                    <div className="muted">Strategy / preference</div>
                    <strong style={{ textTransform: 'capitalize' }}>
                      {selectedRoster.strategy || '—'}
                      {selectedRoster.trackPreference
                        ? ` · prefers ${selectedRoster.trackPreference}`
                        : ''}
                    </strong>
                  </div>
                  <div className="racer-detail__attrs">
                    {(
                      [
                        'baseSpeed',
                        'acceleration',
                        'endurance',
                        'consistency',
                        'staminaRecovery',
                      ] as const
                    ).map((key) => {
                      const val = selectedRoster[key]
                      if (typeof val !== 'number') return null
                      return (
                        <div key={key} className="racer-detail__attr">
                          <span className="muted">{attrLabel(key)}</span>
                          <strong>{Math.round(val)}</strong>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              <div className="racer-detail__section">
                <div className="muted" style={{ marginBottom: '0.45rem' }}>
                  Recent finishes
                </div>
                {recentFinishes.length === 0 ? (
                  <p className="muted" style={{ margin: 0 }}>
                    {mode === 'live'
                      ? 'No completed starts on the current card yet.'
                      : 'Demo card has no per-race results — live mode shows finish order here.'}
                  </p>
                ) : (
                  <ul className="racer-detail__finishes">
                    {recentFinishes.map((f) => (
                      <li key={`${f.raceName}-${f.when}`}>
                        <strong>
                          {f.place === 1 ? '1st' : f.place === 2 ? '2nd' : f.place === 3 ? '3rd' : `${f.place}th`}
                        </strong>
                        <span>{f.raceName}</span>
                        <span className="muted">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(f.when))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
