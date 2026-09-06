import { useEffect, useMemo, useState } from 'react'
import { formatPurse, formatWhen, type Horse, type RaceEntry } from '../../data/fakeSeason'
import type { DataMode } from '../../types/live'
import './RaceHUD.css'

type Props = {
  mode: DataMode
  feedConnected: boolean
  isRacing: boolean
  /** Ably race elapsed ms — shown as Race time while racing */
  elapsedMs?: number
  horses: Horse[]
  races: RaceEntry[]
  currentRace: RaceEntry | null
  /** First future (!completed && startTime > now) race for countdown */
  nextRace: RaceEntry | null
  trackName?: string
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

export function RaceHUD({
  mode,
  feedConnected,
  isRacing,
  elapsedMs = 0,
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
    if (isRacing) {
      setCountdown(0)
      return
    }
    if (!upcoming) {
      setCountdown(0)
      return
    }
    const tick = () => {
      const target = new Date(upcoming.scheduledAt).getTime()
      // Future-only: if somehow past, show 0
      const sec = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setCountdown(sec)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [upcoming, isRacing])

  const raceTimeLabel = formatClock(elapsedMs / 1000)
  const countdownLabel = formatClock(countdown)

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
  const paceLabel =
    mode === 'live' && isRacing
      ? 'Live pace'
      : mode === 'live' && feedConnected
        ? 'At gate'
        : mode === 'live'
          ? 'Standby'
          : 'Fake pace'

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
          {isRacing ? (
            <>
              <span className="muted">Race time</span>
              <strong>{raceTimeLabel}</strong>
              {live && <span className="muted">{live.name}</span>}
            </>
          ) : (
            <>
              <span className="muted">{upcoming ? 'Next race' : 'Countdown'}</span>
              <strong>{upcoming ? countdownLabel : '—'}</strong>
              {upcoming && <span className="muted">{upcoming.name}</span>}
            </>
          )}
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
        {!isRacing && upcoming && (
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
