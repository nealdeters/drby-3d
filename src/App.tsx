import { useState } from 'react'
import { NavBar } from './components/layout/NavBar'
import { LiveDataProvider } from './context/LiveDataContext'
import { useView } from './hooks/useView'
import { RaceView } from './views/RaceView'
import { ScheduleView } from './views/ScheduleView'
import { SeasonsView } from './views/SeasonsView'
import { StandingsView } from './views/StandingsView'
import { TracksView } from './views/TracksView'

export default function App() {
  const { view, setView } = useView()
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <LiveDataProvider>
      <div className="app-shell">
        <NavBar
          view={view}
          onNavigate={(v) => {
            setView(v)
            setMenuOpen(false)
          }}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((o) => !o)}
        />
        <main className="main-content">
          {view === 'race' && <RaceView />}
          {view === 'schedule' && <ScheduleView />}
          {view === 'standings' && <StandingsView />}
          {view === 'seasons' && <SeasonsView />}
          {view === 'tracks' && <TracksView />}
        </main>
      </div>
    </LiveDataProvider>
  )
}
