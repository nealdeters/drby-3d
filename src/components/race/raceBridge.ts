/** Mutable race-camera state: RacingField writes poses; RaceCamera reads them. */
export const raceBridge = {
  packX: 0,
  packY: 0.7,
  packZ: 11,
  headingX: 1,
  headingZ: 0,
  followOk: false,
  followX: 0,
  followY: 0.7,
  followZ: 11,
  followHX: 1,
  followHZ: 0,
  /** Latest world points for on-track pack framing (lead cluster). */
  packPoints: [] as { x: number; y: number; z: number }[],
  packTangents: [] as { x: number; y: number; z: number }[],
}
