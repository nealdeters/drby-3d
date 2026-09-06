import { useLiveData } from '../context/LiveDataContext'

export function StandingsView() {
  const { mode, standings, horseById, seasonNumber, loading } = useLiveData()

  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Leaderboard</span>
          <h1>Standings</h1>
          <p>
            Points, wins, and starts across{' '}
            {mode === 'live' ? `DRBY Season ${seasonNumber}` : 'the DRBY 2026 campaign'}.
          </p>
        </div>
        <span className="badge" data-mode={mode}>
          {mode === 'live' ? `Season ${seasonNumber} · live` : 'DRBY 2026 · demo'}
        </span>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h2>Championship table</h2>
          <span className="muted">
            {loading ? 'Loading…' : `${standings.length} horses`}
          </span>
        </div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Horse</th>
                <th>Jockey</th>
                <th>Pts</th>
                <th>W</th>
                <th>S</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row) => {
                const horse = horseById(row.horseId)
                return (
                  <tr key={row.horseId}>
                    <td>
                      <strong>{row.rank}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: horse?.jersey ?? '#888',
                          marginRight: 8,
                          verticalAlign: 'middle',
                        }}
                      />
                      <strong>
                        {horse ? `${horse.number}. ${horse.name}` : row.horseId}
                      </strong>
                    </td>
                    <td>{horse?.jockey ?? '—'}</td>
                    <td>{row.points}</td>
                    <td>{row.wins}</td>
                    <td>{row.starts}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
