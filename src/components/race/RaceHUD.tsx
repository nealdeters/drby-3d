import { useEffect, useMemo, useState } from 'react'
import { formatPurse, formatWhen, type Horse, type RaceEntry } from '../../data/fakeSeason'
import type { DataMode } from '../../types/live'
import './RaceHUD.css'

type Props = {
  mode: DataMode
  feedConnected: boolean
  isRacing: boolean
  horses: Horse[]
  races: RaceEntry[]
  currentRace: RaceEntry | null
  nextRace: RaceEntry | null
  trackName?: string
}

export function RaceHUD({
  mode,
  feedConnected,
  isRacing,
  horses,
  races,
  currentRace,
  nextRace,
  trackName,
}: Props) {
  const live =
    currentRace ??
    races.find((r) => r.status === 'live') ??
    races.find((r) => r.status === 'upcoming') ??
    races[0] ??
    null
  const upcoming =
    nextRace ??
    races.find((r) => r.status === 'upcoming' && r.id !== live?.id) ??
    null

  const [countdown, setCountdown] = useState(0)

  useEffect(() => {
    if (!upcoming) {
      setCountdown(0)
      return
    }
    const tick = () => {
      const sec = Math.max(
        0,
        Math.floor((new Date(upcoming.scheduledAt).getTime() - Date.now()) / 1000),
      )
      setCountdown(sec)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [upcoming])

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0')
  const ss = String(countdown % 60).padStart(2, '0')

  const fieldHorses = useMemo(() => {
    if (live?.horseIds?.length) {
      const set = new Set(live.horseIds)
      const ordered = live.horseIds
        .map((id) => horses.find((h) => h.id === id))
        .filter(Boolean) as Horse[]
      if (ordered.length) return ordered
      return horses.filter((h) => set.has(h.id))
    }
    return horses
  }, [horses, live])

  const modeLabel = mode === 'live' ? (feedConnected || isRacing ? 'Live' : 'Live · waiting') : 'Demo'
  const paceLabel = mode === 'live' && feedConnected ? 'Live pace' : mode === 'live' ? 'Standby' : 'Fake pace'

  return (
    <div className="race-hud">
      <div className="race-hud__top panel">
        <div>
          <span className="badge" data-mode={mode}>
            {modeLabel}
          </span>
          <h2>{live?.name ?? 'DRBY Race'}</h2>
          <p className="muted">
            {trackName ?? 'Track'}
            {live && live.purse > 0 ? ` · ${formatPurse(live.purse)} purse` : ''}
            {isRacing ? ' · racing' : ''}
          </p>
        </div>
        <div className="race-hud__clock">
          <span className="muted">{upcoming ? 'Next race' : 'Countdown'}</span>
          <strong>
            {upcoming ? `${mm}:${ss}` : '—'}
          </strong>
          {upcoming && <span className="muted">{upcoming.name}</span>}
        </div>
      </div>

      <aside className="race-hud__side panel">
        <div className="panel-header">
          <h2>Field</h2>
          <span className="badge" data-mode={mode}>
            {paceLabel}
          </span>
        </div>
        <div className="panel-body race-hud__field">
          {fieldHorses.map((h) => (
            <div key={h.id} className="race-hud__row">
              <span className="race-hud__num" style={{ background: h.jersey }}>
                {h.number}
              </span>
              <div>
                <strong>{h.name}</strong>
                <div className="muted">{h.jockey}</div>
              </div>
            </div>
          ))}
        </div>
        {upcoming && (
          <div className="race-hud__next">
            <div className="muted">Up next</div>
            <strong>{upcoming.name}</strong>
            <div className="muted">{formatWhen(upcoming.scheduledAt)}</div>
          </div>
        )}
      </aside>
    </div>
  )
}
