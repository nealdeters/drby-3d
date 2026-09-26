import * as Ably from 'ably'
import { Centrifuge } from 'centrifuge'

/** API and realtime wiring. House bus is the default; Ably remains an explicit rollback. */
function resolveApiUrl(): string {
  const override = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')
  if (override) {
    if (override.includes('drby-live.netlify.app')) return `${override}/.netlify/functions`
    if (override.endsWith('/.netlify/functions') || override.endsWith('/live-api')) return override
    return `${override}/.netlify/functions`
  }
  return '/live-api'
}

export const API_URL = resolveApiUrl()
export const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'x-api-key': (import.meta.env.VITE_API_KEY as string | undefined) || '',
}

export function hasApiKeyConfigured(): boolean {
  return Boolean((import.meta.env.VITE_API_KEY as string | undefined)?.trim())
}

export type RealtimeTransport = 'house_bus' | 'ably'
export function realtimeTransport(): RealtimeTransport {
  return (import.meta.env.VITE_REALTIME_TRANSPORT as string | undefined)?.trim() === 'ably'
    ? 'ably'
    : 'house_bus'
}

export function hasAblyKeyConfigured(): boolean {
  return realtimeTransport() === 'ably' && Boolean((import.meta.env.VITE_ABLY_API_KEY as string | undefined)?.trim())
}

export function hasHouseBusConfigured(): boolean {
  return realtimeTransport() === 'house_bus' && Boolean(
    ((import.meta.env.VITE_HOUSE_BUS_WS_URL as string | undefined)?.trim()) ||
    ((import.meta.env.VITE_HOUSE_BUS_URL as string | undefined)?.trim()),
  )
}

export function hasRealtimeConfigured(): boolean {
  return hasAblyKeyConfigured() || hasHouseBusConfigured()
}

const getClientId = (): string => {
  try {
    let clientId = localStorage.getItem('drby-3d-client-id')
    if (!clientId) {
      clientId = `client-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem('drby-3d-client-id', clientId)
    }
    return clientId
  } catch {
    return `client-${Date.now()}`
  }
}

let ablyClient: Ably.Realtime | null = null
export function getAblyClient(): Ably.Realtime | null {
  const ablyKey = (import.meta.env.VITE_ABLY_API_KEY as string | undefined)?.trim()
  if (!ablyKey) return null
  if (!ablyClient) {
    ablyClient = new Ably.Realtime({ key: ablyKey, clientId: getClientId() })
    ablyClient.connection.on('connected', () => console.log('[Ably rollback] connected'))
    ablyClient.connection.on('failed', (err) => console.warn('[Ably rollback] connection failed', err))
  }
  return ablyClient
}

export function ensureAblyConnected(): Ably.Realtime | null {
  return getAblyClient()
}

function houseBusWsUrl(): string {
  const explicit = (import.meta.env.VITE_HOUSE_BUS_WS_URL as string | undefined)?.trim()
  if (explicit) return explicit
  const base = (import.meta.env.VITE_HOUSE_BUS_URL as string | undefined)?.trim().replace(/\/$/, '')
  if (base) return `${base}/connection/websocket`
  throw new Error('Set VITE_HOUSE_BUS_WS_URL (or VITE_HOUSE_BUS_URL)')
}

function houseBusTokenUrl(raceId: string): string {
  const explicit = (import.meta.env.VITE_HOUSE_BUS_TOKEN_URL as string | undefined)?.trim()
  const base = explicit || `${API_URL}/centrifugo-token`
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}raceId=${encodeURIComponent(raceId)}`
}

async function fetchHouseBusToken(raceId: string): Promise<string> {
  const response = await fetch(houseBusTokenUrl(raceId), { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new Error(`house bus token ${response.status}`)
  const data = await response.json() as { token?: string }
  if (!data.token) throw new Error('house bus token missing')
  return data.token
}

export type RaceSubscription = {
  close: () => void
}

export function createRaceSubscription(
  raceId: string,
  onMessage: (message: { data?: unknown }) => void,
  onAttached: (state: { hasBacklog?: boolean; resumed?: boolean }) => void,
  onError: (error: unknown) => void,
): RaceSubscription {
  if (realtimeTransport() === 'ably') {
    const client = getAblyClient()
    if (!client) throw new Error('Ably rollback selected but VITE_ABLY_API_KEY is missing')
    const channel = client.channels.get(`race:${raceId}`, { params: {} })
    const listener = (message: { data?: unknown }) => onMessage(message)
    channel.on('attached', () => onAttached({}))
    channel.subscribe('race-update', listener)
    return {
      close: () => {
        try {
          channel.unsubscribe('race-update', listener)
          void channel.detach()
        } catch (error) {
          onError(error)
        }
      },
    }
  }

  const client = new Centrifuge(houseBusWsUrl(), {
    getToken: () => fetchHouseBusToken(raceId),
  })
  const channel = client.newSubscription(`house:race:${raceId}`)
  channel.on('publication', (ctx: { data?: unknown }) => onMessage({ data: ctx.data }))
  channel.on('subscribed', (ctx: { recovered?: boolean }) => {
    onAttached({ hasBacklog: Boolean(ctx?.recovered), resumed: Boolean(ctx?.recovered) })
  })
  channel.on('error', onError)
  client.on('error', onError)
  channel.subscribe()
  client.connect()
  return {
    close: () => {
      try {
        channel.unsubscribe()
        void channel.removeAllListeners()
        client.disconnect()
      } catch (error) {
        onError(error)
      }
    },
  }
}
