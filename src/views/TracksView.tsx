import { TRACKS } from '../data/fakeSeason'

export function TracksView() {
  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Venues</span>
          <h1>Tracks</h1>
          <p>Dirt ovals and turf courses on the DRBY map — surfaces, distances, and local color.</p>
        </div>
        <span className="badge">Program cards</span>
      </header>

      <div className="grid-cards">
        {TRACKS.map((t) => (
          <article key={t.id} className="card">
            <span className="badge">
              {t.surface} · {t.lengthFurlongs}f
            </span>
            <h3 style={{ marginTop: '0.75rem' }}>{t.name}</h3>
            <p className="muted" style={{ marginBottom: '0.55rem' }}>
              {t.city}
            </p>
            <p style={{ margin: 0, lineHeight: 1.5, color: 'var(--ink-soft)' }}>{t.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
