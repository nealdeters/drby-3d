import { SEASONS } from '../data/fakeSeason'

export function SeasonsView() {
  return (
    <div className="view-scroll">
      <div className="panel-header" style={{ paddingLeft: 0, border: 'none' }}>
        <h2 style={{ color: 'var(--brass-bright)' }}>Seasons</h2>
      </div>
      <div className="grid-cards">
        {SEASONS.map((s) => (
          <article key={s.id} className="card">
            <span className="badge">{s.status}</span>
            <h3 style={{ marginTop: '0.65rem' }}>{s.name}</h3>
            <p className="muted">
              {s.year} · {s.raceCount} races
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
