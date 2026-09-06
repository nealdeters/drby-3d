import { horseById, STANDINGS } from '../data/fakeSeason'

export function StandingsView() {
  return (
    <div className="view-scroll">
      <div className="panel">
        <div className="panel-header">
          <h2>Standings</h2>
          <span className="badge">DRBY 2026 · fake</span>
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
                    <td>{row.rank}</td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: horse?.jersey,
                          marginRight: 8,
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
