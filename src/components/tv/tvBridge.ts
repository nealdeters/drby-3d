import type { HorseSimState } from '../race/trackMath'

export type TvShot = 'spires' | 'tower' | 'clubhouse' | 'rail' | 'stretch' | 'wire'

/** Mutable booth state written by TvField, read by BroadcastCamera + lower-thirds. */
export const tvBridge = {
  field: [] as HorseSimState[],
  shot: 'spires' as TvShot,
  packX: 0,
  packY: 0.7,
  packZ: 11,
  headingX: 1,
  headingZ: 0,
  leaderProgress: 0.5,
  racing: false,
  /** Demo (and live-fallback) race clock in ms. Live HUD prefers Ably elapsed. */
  elapsedMs: 0,
  trackLaps: 1,
  leaderLap: 1,
}
