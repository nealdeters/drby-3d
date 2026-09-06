import { API_URL, headers } from './apiClient'
import type { LiveCompletedSeason, LiveRaceEvent, LiveRacer } from '../types/live'

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { headers })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.status}`)
  }
  return response.json() as Promise<T>
}

/** Read-only race / season endpoints used by the 3D spectator client. */
export const racesService = {
  getSeasonSchedule(): Promise<LiveRaceEvent[]> {
    return getJson('/races/schedule')
  },

  getStandings(): Promise<Record<string, number>> {
    return getJson('/races/standings')
  },

  getCompletedSeasons(): Promise<LiveCompletedSeason[]> {
    return getJson('/races/completed-seasons')
  },

  async getCurrentSeasonNumber(): Promise<number> {
    const data = await getJson<{ number?: number }>('/races/season-number')
    return data.number || 1
  },

  getRoster(): Promise<LiveRacer[]> {
    return getJson('/races/roster')
  },
}
