import { SEASONS } from '../data/fakeSeason'

export function SeasonsView() {
  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Campaigns</span>
          <h1>Seasons</h1>
          <p>Past, present, and upcoming DRBY circuits — pick a meet and follow the card.</p>
        </div>
      </header>

      <div className="grid-cards">
        {SEASONS.map((s) => (
          <article key={s.id} className="card">
            <span
              className="badge"
              data-status={s.status === 'active' ? 'live' : s.status === 'upcoming' ? 'upcoming' : 'final'}
            >
              {s.status}
            </span>
            <h3 style={{ marginTop: '0.75rem' }}>{s.name}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {s.year} · {s.raceCount} races
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}
