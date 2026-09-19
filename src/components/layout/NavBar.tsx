import { useEffect } from 'react'
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
  onCloseMenu: () => void
}

export function NavBar({ view, onNavigate, menuOpen, onToggleMenu, onCloseMenu }: Props) {
  // Always close drawer when the active view changes (nav click, hash, back)
  useEffect(() => {
    onCloseMenu()
  }, [view]) // eslint-disable-line react-hooks/exhaustive-deps -- intentional: close on route change only

  return (
    <header className="nav">
      <div
        className="nav__brand"
        onClick={() => onNavigate('race')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onNavigate('race')
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="DRBY — go to race"
      >
        <span className="nav__logo" aria-hidden="true">
          DRBY<span className="nav__logo-dot">.</span>
        </span>
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
        <>
          <button
            type="button"
            className="nav__scrim"
            aria-label="Close menu"
            onClick={onCloseMenu}
          />
          <div className="nav__drawer" role="dialog" aria-label="Navigation menu">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={view === t.id ? 'nav__drawer-item is-active' : 'nav__drawer-item'}
                onClick={() => onNavigate(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </header>
  )
}
