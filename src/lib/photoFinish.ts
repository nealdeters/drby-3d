/** Keep the finished field on the wire so the winner can be read. */
export const PHOTO_FINISH_HOLD_MS = 30_000

export type PhotoFinishHold = {
  raceId: string
  resultIds: string[]
  until: number
}

export function photoFinishRemainingMs(until: number, now = Date.now()): number {
  return Math.max(0, until - now)
}

export function isPhotoFinishActive(hold: PhotoFinishHold | null, now = Date.now()): boolean {
  return Boolean(hold && hold.until > now)
}
