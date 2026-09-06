import * as Ably from 'ably'

/**
 * Thin web port of nealdeters/drby apiClient.
 * Production: same-origin /live-api proxy -> drby-live Netlify functions (no CORS).
 * Local with VITE_API_BASE pointing at drby-live host: call /.netlify/functions directly.
 */

function resolveApiUrl(): string {
  const override = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')
  if (override) {
    // Direct live host (local dev): append Netlify functions path
    if (override.includes('drby-live.netlify.app')) {
      return `${override}/.netlify/functions`
    }
    // Other overrides: use as-is if already a functions/proxy path
    if (override.endsWith('/.netlify/functions') || override.endsWith('/live-api')) {
      return override
    }
    return `${override}/.netlify/functions`
  }
  // Default: same-origin proxy configured in netlify.toml
  return '/live-api'
}

export const API_URL = resolveApiUrl()

export const headers: HeadersInit = {
  'Content-Type': 'application/json',
  'x-api-key': (import.meta.env.VITE_API_KEY as string | undefined) || '',
}

/** True when caller supplied an API key (reads may still work empty on some envs). */
export function hasApiKeyConfigured(): boolean {
  return Boolean((import.meta.env.VITE_API_KEY as string | undefined)?.trim())
}

export function hasAblyKeyConfigured(): boolean {
  return Boolean((import.meta.env.VITE_ABLY_API_KEY as string | undefined)?.trim())
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
  if (!ablyKey) {
    return null
  }
  if (!ablyClient) {
    const clientId = getClientId()
    ablyClient = new Ably.Realtime({ key: ablyKey, clientId })
    ablyClient.connection.on('connected', () => {
      console.log('[Ably] connected')
    })
    ablyClient.connection.on('failed', (err) => {
      console.warn('[Ably] connection failed', err)
    })
  }
  return ablyClient
}

/** Warm the Realtime connection as soon as live mode is known (before Race view mounts). */
export function ensureAblyConnected(): Ably.Realtime | null {
  return getAblyClient()
}

export type RaceChannelOptions = {
  /** When true, request a single last message on attach (mid-race join only — not a multi-second rewind flood). */
  midRaceSnapshot?: boolean
}

export function getRaceChannel(raceId: string, options?: RaceChannelOptions) {
  const client = getAblyClient()
  if (!client) {
    throw new Error('Ably client not initialized — set VITE_ABLY_API_KEY')
  }
  const name = `race:${raceId}`
  if (options?.midRaceSnapshot) {
    return client.channels.get(name, { params: { rewind: '1' } })
  }
  // Fresh channel options (no rewind) — early subscribe before start should not pull history
  return client.channels.get(name, { params: {} })
}
