import type { HorseSimState } from '../race/trackMath'

export type TvShot = 'home' | 'spires' | 'tower' | 'clubhouse' | 'rail' | 'stretch' | 'wire'

/** Mutable booth state written by TvField, read by BroadcastCamera + lower-thirds. */
export const tvBridge = {
  field: [] as HorseSimState[],
  shot: 'home' as TvShot,
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
  /** True while the user is orbiting; HUD shows look, broadcast lerp pauses. */
  userLook: false,
  /** TV position-bar follow. Null = pack / home / orbit. */
  followId: null as string | null,
  followOk: false,
  followX: 0,
  followY: 0.7,
  followZ: 11,
  followHX: 1,
  followHZ: 0,
}
