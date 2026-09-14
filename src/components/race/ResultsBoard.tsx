import { useEffect, useMemo, useState } from 'react'
import type { Horse } from '../../data/fakeSeason'
import { photoFinishRemainingMs } from '../../lib/photoFinish'
import './ResultsBoard.css'

export type ResultsBoardProps = {
  until: number
  resultIds: string[]
  horses: Horse[]
  raceName?: string
}

function placeLabel(n: number): string {
  const j = n % 10
  const k = n % 100
  if (j === 1 && k !== 11) return `${n}st`
  if (j === 2 && k !== 12) return `${n}nd`
  if (j === 3 && k !== 13) return `${n}rd`
  return `${n}th`
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0.5
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function ResultsBoard({ until, resultIds, horses, raceName }: ResultsBoardProps) {
  const [remainSec, setRemainSec] = useState(() =>
    Math.ceil(photoFinishRemainingMs(until) / 1000),
  )

  useEffect(() => {
    const tick = () => setRemainSec(Math.ceil(photoFinishRemainingMs(until) / 1000))
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [until])

  const rows = useMemo(() => {
    const byId = new Map(horses.map((h) => [h.id, h]))
    return resultIds.map((id, i) => {
      const h = byId.get(id)
      return {
        id,
        place: i + 1,
        name: h?.name ?? id,
        number: h?.number ?? i + 1,
        jersey: h?.jersey ?? '#c44536',
      }
    })
  }, [resultIds, horses])

  if (!rows.length) return null

  const winner = rows[0]
  const clock = `${String(Math.floor(Math.max(0, remainSec) / 60)).padStart(2, '0')}:${String(
    Math.max(0, remainSec) % 60,
  ).padStart(2, '0')}`

  return (
    <div className="results-board" role="dialog" aria-label="Official finish order">
      <div className="results-board__card panel">
        <div className="results-board__head">
          <span className="results-board__kicker">Official</span>
          <h2>{raceName ?? 'Finish'}</h2>
          <p className="muted">Field holds at the wire · clears in {clock}</p>
        </div>
        {winner && (
          <div className="results-board__winner">
            <span className="results-board__win-label">Winner</span>
            <span
              className="results-board__num"
              style={{
                background: winner.jersey,
                color: luminance(winner.jersey) > 0.55 ? '#142038' : '#ffffff',
              }}
            >
              {winner.number}
            </span>
            <strong>{winner.name}</strong>
          </div>
        )}
        <ol className="results-board__list">
          {rows.map((row) => {
            const fg = luminance(row.jersey) > 0.55 ? '#142038' : '#ffffff'
            return (
              <li
                key={row.id}
                className={row.place <= 3 ? 'is-board' : undefined}
                data-place={row.place}
              >
                <span className="results-board__place">{placeLabel(row.place)}</span>
                <span className="results-board__num" style={{ background: row.jersey, color: fg }}>
                  {row.number}
                </span>
                <span className="results-board__name">{row.name}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
