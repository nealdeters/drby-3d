import { formatPurse, formatWhen, RACES, trackById } from '../data/fakeSeason'

export function ScheduleView() {
  return (
    <div className="view-scroll">
      <div className="panel">
        <div className="panel-header">
          <h2>Race Schedule</h2>
          <span className="badge">Fake season data</span>
        </div>
        <div className="panel-body" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Race</th>
                <th>Track</th>
                <th>Purse</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {RACES.map((r) => {
                const track = trackById(r.trackId)
                return (
                  <tr key={r.id}>
                    <td>{formatWhen(r.scheduledAt)}</td>
                    <td>
                      <strong>{r.name}</strong>
                    </td>
                    <td>{track?.name ?? r.trackId}</td>
                    <td>{formatPurse(r.purse)}</td>
                    <td>
                      <span className="badge">{r.status}</span>
                    </td>
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
