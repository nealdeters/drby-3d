import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
import type { Horse } from '../../data/fakeSeason'
import { tvBridge } from './tvBridge'

type Props = {
  horses: Horse[]
  isRacing: boolean
  live: boolean
  elapsedMs: number
  trackName?: string
  progressRef?: MutableRefObject<Record<string, number>>
}

function clock(ms: number) {
  const t = Math.max(0, ms) / 1000
  const s = Math.floor(t)
  const tenths = Math.floor((t - s) * 10)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${tenths}`
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function progressOf(
  horse: Horse,
  map: Record<string, number>,
  useMap: boolean,
): number {
  if (useMap) {
    const v = map[horse.id]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  const st = tvBridge.field.find((s) => s.id === horse.id)
  if (!st) return 0
  if (typeof st.lastOverall === 'number' && Number.isFinite(st.lastOverall)) return st.lastOverall
  return st.progress
}

export function TvLowerThirds({ horses, isRacing, live, elapsedMs, trackName, progressRef }: Props) {
  const [order, setOrder] = useState(horses)
  const [shot, setShot] = useState(tvBridge.shot)
  const [shownMs, setShownMs] = useState(elapsedMs)
  const [lap, setLap] = useState(1)
  const [laps, setLaps] = useState(1)

  useEffect(() => {
    const id = window.setInterval(() => {
      setShot(tvBridge.shot)
      const map = progressRef?.current ?? {}
      const useMap = horses.some((h) => typeof map[h.id] === 'number' && Number.isFinite(map[h.id]))
      const ranked = [...horses].sort((a, b) => {
        const pa = progressOf(a, map, useMap)
        const pb = progressOf(b, map, useMap)
        if (pb !== pa) return pb - pa
        return a.number - b.number
      })
      setOrder(ranked)
      const feedMs = typeof elapsedMs === 'number' && Number.isFinite(elapsedMs) ? elapsedMs : 0
      setShownMs(live && feedMs > 0 ? feedMs : tvBridge.elapsedMs)
      setLap(Math.max(1, tvBridge.leaderLap || 1))
      setLaps(Math.max(1, tvBridge.trackLaps || 1))
    }, 180)
    return () => window.clearInterval(id)
  }, [horses, progressRef, live, elapsedMs])

  const shown = useMemo(() => order.slice(0, 8), [order])
  const pace = isRacing ? 'Live pace' : live ? 'At the gate' : 'Demo card'
  const lapLabel = live ? `Lap ${lap} / ${laps}` : `Lap ${lap}`

  return (
    <div className="tv-thirds">
      <div className="tv-thirds__bug">
        <span className="tv-thirds__net">DRBY TV</span>
        <span className="tv-thirds__meet">{trackName ?? 'Churchill dirt'}</span>
      </div>
      <div className={live && isRacing ? 'tv-thirds__live' : 'tv-thirds__live is-demo'}>
        {live && isRacing ? 'Live' : live ? 'Hold' : 'Demo'}
      </div>
      <div className="tv-thirds__shot">{shot}</div>
      <div className="tv-thirds__bar">
        <div className="tv-thirds__meta">
          <div className="tv-thirds__clock">{clock(shownMs)}</div>
          <div className="tv-thirds__clock-label">Race time</div>
          <div className="tv-thirds__lap">{lapLabel}</div>
        </div>
        <div className="tv-thirds__order">
          {shown.map((h, i) => {
            const ink = luminance(h.jersey) > 0.55 ? '#0a1220' : '#ffffff'
            return (
              <div
                key={h.id}
                className={i === 0 ? 'tv-thirds__horse is-lead' : 'tv-thirds__horse'}
              >
                <span className="tv-thirds__saddle" style={{ background: h.jersey, color: ink }}>
                  {h.number}
                </span>
                <span className="tv-thirds__place">{i + 1}</span>
                <span className="tv-thirds__name">{h.name}</span>
              </div>
            )
          })}
        </div>
        <div className="tv-thirds__pace">
          <strong>{pace}</strong>
          running order
        </div>
      </div>
    </div>
  )
}
