export function AdminView() {
  return (
    <div className="view-scroll">
      <div className="panel" style={{ maxWidth: 560 }}>
        <div className="panel-header">
          <h2>Admin</h2>
          <span className="badge">Stub</span>
        </div>
        <div className="panel-body">
          <p className="muted">
            Race control, season setup, and Ably channel tools will land here. Scaffold only — no
            live controls yet.
          </p>
          <ul className="muted" style={{ lineHeight: 1.7 }}>
            <li>Start / pause fake race clock</li>
            <li>Publish official results</li>
            <li>Manage track cards</li>
          </ul>
          <button type="button" className="btn" disabled style={{ opacity: 0.5 }}>
            Open console (disabled)
          </button>
        </div>
      </div>
    </div>
  )
}
