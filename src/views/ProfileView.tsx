export function ProfileView() {
  return (
    <div className="view-scroll">
      <div className="panel" style={{ maxWidth: 480 }}>
        <div className="panel-header">
          <h2>Profile</h2>
          <span className="badge">Stub</span>
        </div>
        <div className="panel-body">
          <p className="muted">
            Sign-in and wagering profile will connect to the same DRBY backend. For now this is a
            placeholder drawer/page.
          </p>
          <div className="card" style={{ marginTop: '1rem' }}>
            <h3>Guest</h3>
            <p className="muted">Not signed in</p>
            <button type="button" className="btn btn-primary" style={{ marginTop: '0.75rem' }}>
              Sign in (soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
