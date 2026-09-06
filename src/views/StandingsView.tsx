import { horseById, STANDINGS } from '../data/fakeSeason'

export function StandingsView() {
  return (
    <div className="view-scroll">
      <header className="view-hero">
        <div>
          <span className="view-kicker">Leaderboard</span>
          <h1>Standings</h1>
          <p>Points, wins, and starts across the DRBY 2026 campaign.</p>
        </div>
        <span className="badge">DRBY 2026 · fake</span>
      </header>

      <div className="panel">
        <div className="panel-header">
          <h2>Championship table</h2>
          <span className="muted">{STANDINGS.length} horses</span>
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
              {STANDINGS.map((row) => {
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
                          background: horse?.jersey,
                          marginRight: 8,
                          verticalAlign: 'middle',
                        }}
                      />
                      <strong>
                        {horse?.number}. {horse?.name}
                      </strong>
                    </td>
                    <td>{horse?.jockey}</td>
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
