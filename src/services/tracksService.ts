import { API_URL, headers } from './apiClient'
import type { LiveTrack } from '../types/live'

export const tracksService = {
  async getAll(): Promise<LiveTrack[]> {
    const response = await fetch(`${API_URL}/tracks`, { headers })
    if (!response.ok) throw new Error(`Failed to fetch tracks: ${response.status}`)
    return response.json() as Promise<LiveTrack[]>
  },
}
