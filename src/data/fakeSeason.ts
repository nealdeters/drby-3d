export type Horse = {
  id: string
  name: string
  number: number
  jersey: string
  /** Stable coat color for the horse mesh */
  coat: string
  jockey: string
  speedBias: number
}

export type Track = {
  id: string
  name: string
  city: string
  surface: 'dirt' | 'turf'
  lengthFurlongs: number
  description: string
}

export type RaceEntry = {
  id: string
  name: string
  trackId: string
  scheduledAt: string
  purse: number
  status: 'upcoming' | 'live' | 'final'
  horseIds: string[]
}

export type StandingRow = {
  rank: number
  horseId: string
  points: number
  wins: number
  starts: number
}

export type Season = {
  id: string
  name: string
  year: number
  status: 'active' | 'completed' | 'upcoming'
  raceCount: number
}

export const HORSES: Horse[] = [
  { id: 'h1', name: 'Copper Comet', number: 1, coat: '#8a4f2a', jersey: '#c44536', jockey: 'R. Hale', speedBias: 1.02 },
  { id: 'h2', name: 'Midnight Ledger', number: 2, coat: '#1a1412', jersey: '#2c3e6b', jockey: 'S. Quinn', speedBias: 0.98 },
  { id: 'h3', name: 'Brass Thunder', number: 3, coat: '#b08948', jersey: '#c4a574', jockey: 'M. Vega', speedBias: 1.05 },
  { id: 'h4', name: 'Dusty Crown', number: 4, coat: '#6b5238', jersey: '#5b8c5a', jockey: 'A. Moss', speedBias: 0.96 },
  { id: 'h5', name: 'Ember Lane', number: 5, coat: '#9a3b1e', jersey: '#d4552a', jockey: 'J. Park', speedBias: 1.01 },
  { id: 'h6', name: 'Silver Spire', number: 6, coat: '#9aa0a8', jersey: '#8a9bb0', jockey: 'T. Cole', speedBias: 0.99 },
  { id: 'h7', name: 'Oakridge Gale', number: 7, coat: '#4a3220', jersey: '#6b4423', jockey: 'L. Drew', speedBias: 1.03 },
  { id: 'h8', name: 'Velvet Circuit', number: 8, coat: '#3d2a28', jersey: '#7b3f6e', jockey: 'K. Singh', speedBias: 0.97 },
]

export const TRACKS: Track[] = [
  {
    id: 't-oval',
    name: 'Grandstand Oval',
    city: 'Lexington',
    surface: 'dirt',
    lengthFurlongs: 8,
    description: 'Classic one-mile dirt oval. Middle grandstand has the money view.',
  },
  {
    id: 't-meadow',
    name: 'Meadow Brass',
    city: 'Saratoga',
    surface: 'dirt',
    lengthFurlongs: 7,
    description: 'Tight turns and a short stretch — strategy over pure speed.',
  },
  {
    id: 't-harbor',
    name: 'Harbor Downs',
    city: 'Del Mar',
    surface: 'turf',
    lengthFurlongs: 9,
    description: 'Coastal turf course; evening lights for night cards.',
  },
  {
    id: 't-ridge',
    name: 'Ridgeway Park',
    city: 'Churchill',
    surface: 'dirt',
    lengthFurlongs: 10,
    description: 'Long oval with a punishing backstretch headwind.',
  },
]

export const SEASONS: Season[] = [
  { id: 's2026', name: 'DRBY 2026', year: 2026, status: 'active', raceCount: 12 },
  { id: 's2025', name: 'DRBY 2025', year: 2025, status: 'completed', raceCount: 12 },
  { id: 's2027', name: 'DRBY 2027', year: 2027, status: 'upcoming', raceCount: 0 },
]

const now = Date.now()
const hour = 3600_000

export const RACES: RaceEntry[] = [
  {
    id: 'r-live',
    name: 'Evening Feature',
    trackId: 't-oval',
    scheduledAt: new Date(now - 5 * 60_000).toISOString(),
    purse: 25000,
    status: 'live',
    horseIds: HORSES.map((h) => h.id),
  },
  {
    id: 'r-next',
    name: 'Brass Stakes',
    trackId: 't-meadow',
    scheduledAt: new Date(now + 18 * 60_000).toISOString(),
    purse: 40000,
    status: 'upcoming',
    horseIds: HORSES.slice(0, 6).map((h) => h.id),
  },
  {
    id: 'r-3',
    name: 'Dust Bowl Sprint',
    trackId: 't-harbor',
    scheduledAt: new Date(now + 2 * hour).toISOString(),
    purse: 18000,
    status: 'upcoming',
    horseIds: HORSES.slice(2, 8).map((h) => h.id),
  },
  {
    id: 'r-4',
    name: 'Oakridge Cup',
    trackId: 't-ridge',
    scheduledAt: new Date(now + 26 * hour).toISOString(),
    purse: 55000,
    status: 'upcoming',
    horseIds: HORSES.map((h) => h.id),
  },
  {
    id: 'r-prev',
    name: 'Opening Mile',
    trackId: 't-oval',
    scheduledAt: new Date(now - 3 * hour).toISOString(),
    purse: 20000,
    status: 'final',
    horseIds: HORSES.map((h) => h.id),
  },
]

export const STANDINGS: StandingRow[] = [
  { rank: 1, horseId: 'h3', points: 86, wins: 4, starts: 9 },
  { rank: 2, horseId: 'h1', points: 78, wins: 3, starts: 10 },
  { rank: 3, horseId: 'h7', points: 71, wins: 3, starts: 9 },
  { rank: 4, horseId: 'h5', points: 64, wins: 2, starts: 10 },
  { rank: 5, horseId: 'h2', points: 58, wins: 2, starts: 9 },
  { rank: 6, horseId: 'h6', points: 49, wins: 1, starts: 8 },
  { rank: 7, horseId: 'h4', points: 41, wins: 1, starts: 9 },
  { rank: 8, horseId: 'h8', points: 36, wins: 0, starts: 8 },
]

export function horseById(id: string): Horse | undefined {
  return HORSES.find((h) => h.id === id)
}

export function trackById(id: string): Track | undefined {
  return TRACKS.find((t) => t.id === id)
}

export function formatPurse(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

export function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
