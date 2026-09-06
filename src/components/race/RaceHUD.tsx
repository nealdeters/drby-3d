import { useEffect, useState } from 'react'
import { formatPurse, formatWhen, HORSES, RACES, trackById } from '../../data/fakeSeason'
import './RaceHUD.css'

export function RaceHUD() {
  const live = RACES.find((r) => r.status === 'live') ?? RACES[0]
  const next = RACES.find((r) => r.status === 'upcoming')
  const track = trackById(live.trackId)
  const [countdown, setCountdown] = useState(18 * 60)

  useEffect(() => {
    if (!next) return
    const tick = () => {
      const sec = Math.max(0, Math.floor((new Date(next.scheduledAt).getTime() - Date.now()) / 1000))
      setCountdown(sec)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [next])

  const mm = String(Math.floor(countdown / 60)).padStart(2, '0')
  const ss = String(countdown % 60).padStart(2, '0')

  return (
    <div className="race-hud">
      <div className="race-hud__top panel">
        <div>
          <span className="badge">Live</span>
          <h2>{live.name}</h2>
          <p className="muted">
            {track?.name} · {formatPurse(live.purse)} purse
          </p>
        </div>
        <div className="race-hud__clock">
          <span className="muted">Next race</span>
          <strong>
            {mm}:{ss}
          </strong>
          {next && <span className="muted">{next.name}</span>}
        </div>
      </div>

      <aside className="race-hud__side panel">
        <div className="panel-header">
          <h2>Field</h2>
          <span className="badge">Fake pace</span>
        </div>
        <div className="panel-body race-hud__field">
          {HORSES.map((h) => (
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
        {next && (
          <div className="race-hud__next">
            <div className="muted">Up next</div>
            <strong>{next.name}</strong>
            <div className="muted">{formatWhen(next.scheduledAt)}</div>
          </div>
        )}
      </aside>
    </div>
  )
}
