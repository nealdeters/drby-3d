/** Live DRBY backend types (match nealdeters/drby + drby_scheduler). */

export type Surface = 'asphalt' | 'dirt' | 'grass'
export type Strategy = 'aggressive' | 'conservative' | 'balanced'
export type RacerStatus = 'active' | 'finished' | 'injured' | 'waiting' | 'dnf'

export interface LiveRacer {
  id: string
  name: string
  color: string
  baseSpeed: number
  health: number
  strategy: Strategy
  trackPreference: Surface
  acceleration: number
  endurance: number
  consistency: number
  staminaRecovery: number
  lane: number
  progress: number
  laps: number
  totalDistance: number
  status: RacerStatus
  currentSpeed: number
  finishTime?: number
}

export interface LiveTrack {
  id: string
  name: string
  surface: Surface
  length: number
  laps: number
}

export interface LiveRaceEvent {
  id: string
  startTime: number
  seed: number
  track: LiveTrack
  racerIds: string[]
  completed: boolean
  results?: string[]
  finishTimes?: Record<string, number>
}

export interface LiveCompletedSeason {
  id: string
  number: number
  completedAt: string
  winner?: {
    id: string
    name: string
    color: string
    points: number
  }
  totalRaces: number
  finalStandings: Record<string, number>
  racerStats?: Array<{
    id: string
    name: string
    color: string
    points: number
    first: number
    second?: number
    third?: number
    racesRun?: number
  }>
  races?: LiveRaceEvent[]
}

export type RaceUpdateType = 'started' | 'progress' | 'finished'

export interface RaceUpdate {
  type: RaceUpdateType
  raceId: string
  timestamp: number
  elapsed?: number
  racers?: LiveRacer[]
  results?: LiveRacer[]
  progressMap?: Record<string, number>
}

export type DataMode = 'live' | 'demo'
