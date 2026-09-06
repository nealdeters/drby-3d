import { useLiveData } from '../context/LiveDataContext'

export function SeasonsView() {
  const { mode, seasons, loading } = useLiveData()

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Campaigns</span>
          <h1>Seasons</h1>
          <p>Past, present, and upcoming DRBY circuits — pick a meet and follow the card.</p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? 'Live API' : 'Demo'}
        </span>
      </header>

      {loading && <p className="muted">Loading seasons…</p>}

      <div className="grid-cards">
        {seasons.map((s) => (
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
