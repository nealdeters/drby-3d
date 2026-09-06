import { createContext, useContext, type ReactNode } from 'react'
import { useLiveSeason, type LiveSeasonState } from '../hooks/useLiveSeason'

const LiveDataContext = createContext<LiveSeasonState | null>(null)

export function LiveDataProvider({ children }: { children: ReactNode }) {
  const season = useLiveSeason()
  return <LiveDataContext.Provider value={season}>{children}</LiveDataContext.Provider>
}

export function useLiveData(): LiveSeasonState {
  const ctx = useContext(LiveDataContext)
  if (!ctx) throw new Error('useLiveData must be used within LiveDataProvider')
  return ctx
}
