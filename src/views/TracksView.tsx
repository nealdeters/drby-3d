import { useLiveData } from '../context/LiveDataContext'

export function TracksView() {
  const { mode, tracks, loading } = useLiveData()

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Venues</span>
          <h1>Tracks</h1>
          <p>Dirt ovals and turf courses on the DRBY map — surfaces, distances, and local color.</p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? 'Live API' : 'Program cards'}
        </span>
      </header>

      {loading && <p className="muted">Loading tracks…</p>}

      <div className="grid-cards">
        {tracks.map((t) => (
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
