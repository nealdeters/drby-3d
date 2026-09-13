import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
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
  /** Resolved racing-strip surface (asphalt / dirt / turf) for tote chip */
  trackSurface?: 'asphalt' | 'dirt' | 'turf' | 'grass'
  /** Overall progress 0–1 per horse id — read on a throttle, never every frame */
  progressRef?: MutableRefObject<Record<string, number>>
  /** Locked finish order (ids in place order) — finished horses stay put */
  finishOrderRef?: MutableRefObject<string[]>
  /** TV only: highlight + follow this horse. Race page omits these. */
  selectedHorseId?: string | null
  onSelectHorse?: (id: string) => void
  /** Scheduled / locked lap count for this card (not compressed display). */
  trackLaps?: number
}

type OrderRow = {
  id: string
  place: number
  number: number
  name: string
  jersey: string
  progress: number
}

function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec))
  const mm = String(Math.floor(s / 60)).padStart(2, '0')
  const ss = String(s % 60).padStart(2, '0')
  return `${mm}:${ss}`
}

/** 1-based lap from raw overall 0–1. Never use compressOverallToPack. */
function lapFromOverall(overall: number, laps: number): number {
  const L = laps > 0 ? Math.floor(laps) : 1
  if (!Number.isFinite(overall) || overall <= 0) return 1
  if (overall >= 0.999) return L
  return Math.min(L, Math.max(1, Math.floor(overall * L) + 1))
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
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
  trackSurface,
  progressRef,
  finishOrderRef,
  selectedHorseId = null,
  onSelectHorse,
  trackLaps = 1,
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
  const [order, setOrder] = useState<OrderRow[]>([])
  const [leaderLap, setLeaderLap] = useState(1)

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

  const laps = trackLaps > 0 ? Math.floor(trackLaps) : 1
  const selectable = typeof onSelectHorse === 'function'
  const rowClass = (row: OrderRow, base: string) => {
    const done = row.progress >= 1
    return `${base}${done ? ' is-finished' : ''}${selectable ? ' is-selectable' : ''}${selectedHorseId === row.id ? ' is-tracked' : ''}`
  }
  const onRowActivate = (id: string) => {
    if (!onSelectHorse) return
    onSelectHorse(id)
  }

  // Throttled running order from progressRef (~6 Hz) — no setState every frame.
  // Finished horses keep locked places; only still-racing horses reshuffle below.
  useEffect(() => {
    const build = (): OrderRow[] => {
      const byId = new Map(fieldHorses.map((h, i) => [h.id, { h, i }]))
      const progressOf = (id: string) => {
        const fromRef = progressRef?.current?.[id]
        return typeof fromRef === 'number' && Number.isFinite(fromRef) ? fromRef : 0
      }

      const finishOrder = finishOrderRef?.current ?? []
      const finishedIds: string[] = []
      const seen = new Set<string>()
      for (const id of finishOrder) {
        if (byId.has(id) && !seen.has(id)) {
          finishedIds.push(id)
          seen.add(id)
        }
      }
      // Also lock anyone who has crossed overall >= 1 even if finishOrder lagged
      for (const h of fieldHorses) {
        if (!seen.has(h.id) && progressOf(h.id) >= 1) {
          finishedIds.push(h.id)
          seen.add(h.id)
        }
      }

      const finishedRows: OrderRow[] = finishedIds.map((id, idx) => {
        const entry = byId.get(id)!
        return {
          id,
          place: idx + 1,
          number: entry.h.number || entry.i + 1,
          name: entry.h.name,
          jersey: entry.h.jersey,
          progress: Math.max(1, progressOf(id)),
        }
      })

      const racingRows: OrderRow[] = fieldHorses
        .filter((h) => !seen.has(h.id))
        .map((h, i) => ({
          id: h.id,
          place: 0,
          number: h.number || i + 1,
          name: h.name,
          jersey: h.jersey,
          progress: progressOf(h.id),
        }))
        .sort((a, b) => b.progress - a.progress || a.number - b.number)
        .map((r, i) => ({ ...r, place: finishedRows.length + i + 1 }))

      return [...finishedRows, ...racingRows]
    }

    const publish = () => {
      const rows = build()
      setOrder(rows)
      let lead = 0
      for (const row of rows) {
        if (row.progress > lead) lead = row.progress
      }
      setLeaderLap(lapFromOverall(lead, laps))
    }
    publish()
    const id = window.setInterval(publish, 160) // ~6 Hz
    return () => window.clearInterval(id)
  }, [fieldHorses, progressRef, finishOrderRef, laps])

  const raceTimeLabel = formatClock(elapsedMs / 1000)
  const countdownLabel = formatClock(countdown)

  const modeLabel = mode === 'live' ? (feedConnected || isRacing ? 'Live' : 'Live · waiting') : 'Demo'
  const paceLabel =
    mode === 'live' && isRacing
      ? 'Live pace'
      : mode === 'live' && feedConnected
        ? 'At gate'
        : mode === 'live'
          ? 'Standby'
          : 'Demo pace'

  return (
    <div className="race-hud">
      <div className="race-hud__top panel">
        <div>
          <span className="badge" data-mode={mode}>
            {modeLabel}
          </span>
          <h2>{live?.name ?? 'Race day'}</h2>
          <p className="muted">
            {trackName ?? 'Track'}
            {` · ${laps} lap${laps === 1 ? '' : 's'}`}
            {live && live.purse > 0 ? ` · ${formatPurse(live.purse)} purse` : ''}
            {isRacing ? ' · racing' : ''}
          </p>
          {trackSurface && (
            <div className="race-hud__surface muted" title={`Surface: ${trackSurface}`}>
              <span
                className="race-hud__surface-chip"
                data-surface={trackSurface === 'grass' ? 'turf' : trackSurface}
                aria-hidden
              />
              <span>
                {trackSurface === 'asphalt'
                  ? 'Asphalt'
                  : trackSurface === 'dirt'
                    ? 'Dirt'
                    : 'Grass'}
              </span>
            </div>
          )}
        </div>
        <div className="race-hud__clock">
          {isRacing ? (
            <>
              <span className="muted">Race time</span>
              <strong>{raceTimeLabel}</strong>
              <span className="race-hud__laps">Lap {leaderLap} / {laps}</span>
            </>
          ) : (
            <>
              <span className="muted">{upcoming ? 'Next race' : 'Countdown'}</span>
              <strong>{upcoming ? countdownLabel : '—'}</strong>
              {upcoming && <span className="muted">{upcoming.name}</span>}
              <span className="muted">{laps} lap{laps === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
      </div>

      {/* Always-visible running order (mobile top strip + desktop) */}
      <div className="race-hud__order panel" aria-label="Running order">
        <div className="race-hud__order-label">
          <span className="muted">{isRacing ? 'Running order' : 'Field'}</span>
          <span className="badge" data-mode={mode}>
            {paceLabel}
          </span>
        </div>
        <div className="race-hud__order-scroll">
          {order.map((row) => {
            const fg = luminance(row.jersey) > 0.55 ? '#142038' : '#ffffff'
            const done = row.progress >= 1
            return (
              <div
                key={row.id}
                className={rowClass(row, 'race-hud__order-row')}
                data-finished={done ? 'true' : undefined}
                role={selectable ? 'button' : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-pressed={selectable ? selectedHorseId === row.id : undefined}
                onClick={selectable ? () => onRowActivate(row.id) : undefined}
                onKeyDown={
                  selectable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowActivate(row.id)
                        }
                      }
                    : undefined
                }
              >
                <span className="race-hud__place">{row.place}</span>
                <span
                  className="race-hud__num"
                  style={{ background: row.jersey, color: fg }}
                >
                  {row.number}
                </span>
                <span className="race-hud__order-name">{row.name}</span>
              </div>
            )
          })}
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
          {order.map((row) => {
            const fg = luminance(row.jersey) > 0.55 ? '#142038' : '#ffffff'
            const done = row.progress >= 1
            return (
              <div
                key={row.id}
                className={rowClass(row, 'race-hud__row')}
                data-finished={done ? 'true' : undefined}
                role={selectable ? 'button' : undefined}
                tabIndex={selectable ? 0 : undefined}
                aria-pressed={selectable ? selectedHorseId === row.id : undefined}
                onClick={selectable ? () => onRowActivate(row.id) : undefined}
                onKeyDown={
                  selectable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          onRowActivate(row.id)
                        }
                      }
                    : undefined
                }
              >
                <span className="race-hud__place">{row.place}</span>
                <span className="race-hud__num" style={{ background: row.jersey, color: fg }}>
                  {row.number}
                </span>
                <div>
                  <strong>{row.name}</strong>
                  <div className="muted">
                    {done ? 'Finished' : `Lap ${lapFromOverall(row.progress, laps)} / ${laps}`}
                  </div>
                </div>
              </div>
            )
          })}
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
