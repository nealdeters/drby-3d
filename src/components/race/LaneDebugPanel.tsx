import { useEffect, useMemo, useState, type MutableRefObject } from 'react'
import type { Horse } from '../../data/fakeSeason'
import type { LiveRacer } from '../../types/live'
import type { RacingLineDecision } from './racingLinePlanner'

type Props = {
  horses: Horse[]
  laneDecisionRef: MutableRefObject<Record<string, NonNullable<LiveRacer['laneDecision']>>>
  laneChangeRef: MutableRefObject<Record<string, NonNullable<LiveRacer['laneChange']>>>
  lineDecisionRef?: MutableRefObject<Record<string, RacingLineDecision>>
}

type Row = {
  id: string
  name: string
  decision: NonNullable<LiveRacer['laneDecision']>
  change?: NonNullable<LiveRacer['laneChange']>
}

/**
 * Explicit race telemetry only; this intentionally shows inputs/factors and the
 * selected action, never hidden model reasoning. Enable with ?debug=1.
 */
export function LaneDebugPanel({ horses, laneDecisionRef, laneChangeRef, lineDecisionRef }: Props) {
  const [enabled, setEnabled] = useState(false)
  const [rows, setRows] = useState<Row[]>([])
  const [lineRows, setLineRows] = useState<RacingLineDecision[]>([])

  const names = useMemo(() => new Map(horses.map((horse) => [horse.id, horse.name])), [horses])

  useEffect(() => {
    const debug = new URLSearchParams(window.location.search).get('debug') === '1'
    setEnabled(debug)
    if (!debug) return

    const update = () => {
      const next = Object.entries(laneDecisionRef.current)
        .map(([id, decision]) => ({
          id,
          name: names.get(id) ?? id,
          decision,
          change: laneChangeRef.current[id],
        }))
        .sort((a, b) => (b.decision.evaluatedAtTick ?? 0) - (a.decision.evaluatedAtTick ?? 0))
        .slice(0, 8)
      setRows(next)
      if (lineDecisionRef) setLineRows(Object.values(lineDecisionRef.current))
    }
    update()
    const timer = window.setInterval(update, 120)
    return () => window.clearInterval(timer)
  }, [laneDecisionRef, laneChangeRef, lineDecisionRef, names])

  if (!enabled || (!rows.length && !lineRows.length)) return null

  return (
    <aside className="lane-debug" data-testid="lane-debug">
      <div className="lane-debug__title">Lane decisions · explicit telemetry</div>
      {rows.map((row) => {
        const d = row.decision
        const moving = d.decision === 'move'
        return (
          <div className="lane-debug__row" key={row.id}>
            <strong>{row.name}</strong>
            <span>
              lane {d.currentLane ?? '—'} → {d.targetLane ?? '—'} · {moving ? 'MOVE' : 'HOLD'}
            </span>
            <span>
              {d.reason ?? 'no reason'}
              {d.blockerId ? ` · blocker ${names.get(d.blockerId) ?? d.blockerId}` : ''}
            </span>
            <span>
              target space {d.targetSpaceAvailable ? 'available' : 'occupied'} · inside advantage {d.insideLineAdvantage ?? 0}
              {row.change ? ` · transition ${Math.round((row.change.progress ?? 0) * 100)}%` : ''}
            </span>
          </div>
        )
      })}
      {lineRows.length > 0 && (
        <>
          <div className="lane-debug__title">Continuous racing-line steering</div>
          {lineRows.map((d) => (
            <div className="lane-debug__row" key={`line-${d.horseId}`}>
              <strong>{names.get(d.horseId) ?? d.horseId}</strong>
              <span>
                radial {d.currentRadial.toFixed(2)} → {d.desiredRadial.toFixed(2)} · {d.decision.toUpperCase()}
              </span>
              <span>
                {d.reason}{d.blockerId ? ` · blocker ${names.get(d.blockerId) ?? d.blockerId}` : ''}
              </span>
              <span>
                target space {d.targetSpaceAvailable ? 'available' : 'occupied'} · competing {d.competingIds.length}
              </span>
            </div>
          ))}
        </>
      )}
    </aside>
  )
}
