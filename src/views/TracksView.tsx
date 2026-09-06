import { TRACKS } from '../data/fakeSeason'

export function TracksView() {
  return (
    <div className="view-scroll">
      <div className="panel-header" style={{ paddingLeft: 0, border: 'none' }}>
        <h2 style={{ color: 'var(--brass-bright)' }}>Tracks</h2>
        <span className="badge">Program cards</span>
      </div>
      <div className="grid-cards">
        {TRACKS.map((t) => (
          <article key={t.id} className="card">
            <span className="badge">
              {t.surface} · {t.lengthFurlongs}f
            </span>
            <h3 style={{ marginTop: '0.65rem' }}>{t.name}</h3>
            <p className="muted" style={{ marginBottom: '0.5rem' }}>
              {t.city}
            </p>
            <p style={{ margin: 0, lineHeight: 1.45 }}>{t.description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}
