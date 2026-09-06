import type { ViewId } from '../../hooks/useView'
import './NavBar.css'

const TABS: { id: ViewId; label: string }[] = [
  { id: 'race', label: 'Race' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'standings', label: 'Standings' },
  { id: 'seasons', label: 'Seasons' },
  { id: 'tracks', label: 'Tracks' },
]

type Props = {
  view: ViewId
  onNavigate: (v: ViewId) => void
  menuOpen: boolean
  onToggleMenu: () => void
}

export function NavBar({ view, onNavigate, menuOpen, onToggleMenu }: Props) {
  return (
    <header className="nav">
      <div className="nav__brand" onClick={() => onNavigate('race')} role="button" tabIndex={0}>
        <span className="nav__mark" aria-hidden />
        <div>
          <strong>DRBY</strong>
          <span className="nav__sub">Middle Stands · 3D</span>
        </div>
      </div>

      <nav className="nav__tabs" aria-label="Primary">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={view === t.id ? 'nav__tab is-active' : 'nav__tab'}
            onClick={() => onNavigate(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="nav__actions">
        <button type="button" className="nav__ghost" onClick={() => onNavigate('profile')}>
          Profile
        </button>
        <button type="button" className="nav__ghost" onClick={() => onNavigate('admin')}>
          Admin
        </button>
        <button
          type="button"
          className="nav__burger"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={onToggleMenu}
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      {menuOpen && (
        <div className="nav__drawer">
          {[...TABS, { id: 'profile' as ViewId, label: 'Profile' }, { id: 'admin' as ViewId, label: 'Admin' }].map(
            (t) => (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'nav__drawer-item is-active' : 'nav__drawer-item'}
                onClick={() => {
                  onNavigate(t.id)
                  onToggleMenu()
                }}
              >
                {t.label}
              </button>
            ),
          )}
        </div>
      )}
    </header>
  )
}
