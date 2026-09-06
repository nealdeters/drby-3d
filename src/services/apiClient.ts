import * as Ably from 'ably'

/**
 * Thin web port of nealdeters/drby apiClient.
 * Live site: https://drby-live.netlify.app + /.netlify/functions/*
 */

export function getBaseUrl(): string {
  const override = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '')
  if (override) return override
  // Default to the same live backend as drby-live / drby_scheduler
  return 'https://drby-live.netlify.app'
}

export const API_URL = `${getBaseUrl()}/.netlify/functions`

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

export function getRaceChannel(raceId: string) {
  const client = getAblyClient()
  if (!client) {
    throw new Error('Ably client not initialized — set VITE_ABLY_API_KEY')
  }
  return client.channels.get(`race:${raceId}`)
}
