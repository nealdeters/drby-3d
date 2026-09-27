import type { RaceUpdate, RaceUpdateType } from '../types/live'

type RuntimeRaceUpdate = Partial<Pick<RaceUpdate, 'type' | 'elapsed' | 'progressMap' | 'racers' | 'results'>> & {
  raceId?: unknown
}

function hasPositiveProgress(update: RuntimeRaceUpdate): boolean {
  if (update.progressMap && Object.values(update.progressMap).some((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    return true
  }
  return Boolean(
    update.racers?.some((r) =>
      (typeof r.progress === 'number' && Number.isFinite(r.progress) && r.progress > 0) ||
      (typeof r.totalDistance === 'number' && Number.isFinite(r.totalDistance) && r.totalDistance > 0),
    ),
  )
}

/**
 * Normalize runtime bus payloads before the render state machine consumes them.
 * Older house-bus publishers used `tick`/`update` and occasionally serialized
 * the JSON object as a string. A valid motion packet must start the field even
 * when the separate `started` packet was missed during subscription.
 */
export function parseRaceUpdate(value: unknown): RaceUpdate | null {
  let candidate: unknown = value
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch {
      return null
    }
  }
  if (!candidate || typeof candidate !== 'object') return null
  const update = candidate as RuntimeRaceUpdate
  if (typeof update.raceId !== 'string' || !update.raceId) return null
  const knownType = update.type === 'started' || update.type === 'progress' || update.type === 'finished'
  if (!knownType && !Array.isArray(update.racers) && !update.progressMap && !Array.isArray(update.results)) return null
  return update as RaceUpdate
}

export function inferRaceUpdateType(update: RuntimeRaceUpdate): RaceUpdateType | null {
  if (update.type === 'started' || update.type === 'progress' || update.type === 'finished') {
    return update.type
  }
  if (Array.isArray(update.results) && update.results.length > 0) return 'finished'
  if (hasPositiveProgress(update)) return 'progress'
  if (typeof update.elapsed === 'number' && Number.isFinite(update.elapsed) && update.elapsed > 0) {
    return 'progress'
  }
  // A roster/progress-map-at-zero packet is the best available start marker
  // when a legacy publisher omitted `type: started`.
  if (Array.isArray(update.racers) || update.progressMap) return 'started'
  return null
}

export function updateHasMotion(update: RuntimeRaceUpdate): boolean {
  return hasPositiveProgress(update) || (
    typeof update.elapsed === 'number' && Number.isFinite(update.elapsed) && update.elapsed > 0
  )
}
