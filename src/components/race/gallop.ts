/**
 * Shared locomotion for Race boxes.
 *
 * Gallop: left-lead transverse — trailing hind (HR) → lead hind (HL) →
 * trailing fore (FR) → lead fore (FL) → airborne.
 *
 * Trot: two-beat diagonal — FL+HR together, then FR+HL, with a short
 * suspension between diagonals.
 *
 * Hip swing: +X rotation sends a downward limb toward -Z (aft) when the horse
 * faces +Z, so +swing is the stance push and −swing is the forward reach.
 *
 * Carousel rule (gallop): flight hips do not lerp through the standing pose.
 * When a hip must cross 0, the knee is already folded ~90°. Only a supporting
 * stance leg may read "down", and even that keeps a residual joint flex.
 */

export type LegId = 'fl' | 'fr' | 'hl' | 'hr'

export type GallopSample = {
  swing: Record<LegId, number>
  knee: Record<LegId, number>
  bob: number
  gather: number
  airborne: number
  barrelPitch: number
  barrelRoll: number
  neckPitch: number
  headPitch: number
  tailPitch: number
  tailYaw: number
  /** Jockey deltas on top of the rest two-point. */
  hipY: number
  hipZ: number
  foldDelta: number
  helmetPitch: number
  armGive: number
  thighDelta: number
}

export function wrap01(t: number): number {
  return t - Math.floor(t)
}

export const GATE_POSE: GallopSample = {
  swing: { fl: 0, fr: 0, hl: 0, hr: 0 },
  knee: { fl: 0.18, fr: 0.18, hl: 0.2, hr: 0.2 },
  bob: 0,
  gather: 0,
  airborne: 0,
  barrelPitch: 0,
  barrelRoll: 0,
  neckPitch: 0.04,
  headPitch: -0.06,
  tailPitch: 0.12,
  tailYaw: 0,
  hipY: 0,
  hipZ: 0,
  foldDelta: 0,
  helmetPitch: 0,
  armGive: 0,
  thighDelta: 0,
}

const STANCE = 0.2
/** Left-lead racing gallop — contact starts. */
const HR_T = 0.0
const HL_T = 0.16
const FR_T = 0.31
const FL_T = 0.47

type Key = { t: number; swing: number; knee: number }

/**
 * Keys are 0..1 from that leg's stance start.
 * Flight hips stay clearly aft, then snap forward while the joint is folded —
 * they do not spend the recovery hanging at swing ≈ 0.
 */
const HIND_KEYS: Key[] = [
  { t: 0.0, swing: -0.62, knee: 0.32 },
  { t: 0.1, swing: 0.12, knee: 0.48 },
  { t: 0.2, swing: 0.98, knee: 0.58 },
  { t: 0.34, swing: 0.72, knee: 1.52 },
  { t: 0.44, swing: 0.42, knee: 1.62 },
  { t: 0.52, swing: -0.42, knee: 1.58 },
  { t: 0.68, swing: -0.88, knee: 1.05 },
  { t: 0.86, swing: -0.78, knee: 0.42 },
  { t: 1.0, swing: -0.62, knee: 0.32 },
]

const FORE_KEYS: Key[] = [
  { t: 0.0, swing: -0.55, knee: 0.28 },
  { t: 0.1, swing: 0.1, knee: 0.4 },
  { t: 0.2, swing: 0.82, knee: 0.5 },
  { t: 0.34, swing: 0.92, knee: 1.48 },
  { t: 0.46, swing: 0.48, knee: 1.6 },
  { t: 0.54, swing: -0.38, knee: 1.42 },
  { t: 0.72, swing: -0.78, knee: 0.72 },
  { t: 0.9, swing: -0.68, knee: 0.34 },
  { t: 1.0, swing: -0.55, knee: 0.28 },
]

/** One diagonal of a working/extended trot. Mid-stance is allowed to be a
 *  supporting cannon; flight folds before the hip crosses 0. */
const TROT_HIND_KEYS: Key[] = [
  { t: 0.0, swing: -0.5, knee: 0.26 },
  { t: 0.1, swing: -0.12, knee: 0.3 },
  { t: 0.22, swing: 0.34, knee: 0.34 },
  { t: 0.4, swing: 0.7, knee: 0.46 },
  { t: 0.5, swing: 0.48, knee: 1.18 },
  { t: 0.62, swing: 0.02, knee: 1.42 },
  { t: 0.74, swing: -0.5, knee: 1.28 },
  { t: 0.88, swing: -0.58, knee: 0.48 },
  { t: 1.0, swing: -0.5, knee: 0.26 },
]

const TROT_FORE_KEYS: Key[] = [
  { t: 0.0, swing: -0.46, knee: 0.22 },
  { t: 0.1, swing: -0.08, knee: 0.26 },
  { t: 0.22, swing: 0.3, knee: 0.3 },
  { t: 0.4, swing: 0.64, knee: 0.42 },
  { t: 0.5, swing: 0.42, knee: 1.12 },
  { t: 0.62, swing: -0.02, knee: 1.34 },
  { t: 0.74, swing: -0.48, knee: 1.18 },
  { t: 0.88, swing: -0.54, knee: 0.4 },
  { t: 1.0, swing: -0.46, knee: 0.22 },
]

function smooth01(u: number): number {
  const x = u < 0 ? 0 : u > 1 ? 1 : u
  return x * x * (3 - 2 * x)
}

function sampleKeys(keys: Key[], d: number): { swing: number; knee: number } {
  const p = wrap01(d)
  let i = 0
  while (i < keys.length - 2 && keys[i + 1].t <= p) i++
  const a = keys[i]
  const b = keys[i + 1]
  const span = b.t - a.t
  const u = span <= 1e-6 ? 1 : smooth01((p - a.t) / span)
  return {
    swing: a.swing + (b.swing - a.swing) * u,
    knee: a.knee + (b.knee - a.knee) * u,
  }
}

function limb(phase: number, stanceStart: number, hind: boolean): { swing: number; knee: number } {
  const d = wrap01(phase - stanceStart)
  return sampleKeys(hind ? HIND_KEYS : FORE_KEYS, d)
}

function trotLimb(phase: number, stanceStart: number, hind: boolean): { swing: number; knee: number } {
  const d = wrap01(phase - stanceStart)
  return sampleKeys(hind ? TROT_HIND_KEYS : TROT_FORE_KEYS, d)
}

/** 1 inside [start, start+dur) on the unit circle, faded at the lips. */
function stanceWeight(phase: number, start: number, dur: number, fade = 0.035): number {
  const p = wrap01(phase)
  const a = wrap01(start)
  let d = p - a
  if (d < 0) d += 1
  if (d >= dur) return 0
  const f = Math.min(fade, dur * 0.25)
  if (d < f) return d / f
  if (d > dur - f) return (dur - d) / f
  return 1
}

function pulse(phase: number, center: number, half: number): number {
  const d = Math.min(Math.abs(phase - center), 1 - Math.abs(phase - center))
  return Math.max(0, 1 - d / half)
}

/** A carousel pole: long cannon hanging under a near-vertical hip. */
export function isCarouselPole(swing: number, knee: number): boolean {
  return Math.abs(swing) < 0.28 && knee < 0.7
}

export function countCarouselPoles(pose: GallopSample): number {
  const ids: LegId[] = ['fl', 'fr', 'hl', 'hr']
  return ids.filter((id) => isCarouselPole(pose.swing[id], pose.knee[id])).length
}

export function sampleGallop(phase: number): GallopSample {
  const p = wrap01(phase)
  const hr = limb(p, HR_T, true)
  const hl = limb(p, HL_T, true)
  const fr = limb(p, FR_T, false)
  const fl = limb(p, FL_T, false)

  const hrW = stanceWeight(p, HR_T, STANCE)
  const hlW = stanceWeight(p, HL_T, STANCE)
  const frW = stanceWeight(p, FR_T, STANCE)
  const flW = stanceWeight(p, FL_T, STANCE)
  const support = Math.max(hrW, hlW, frW, flW)
  const airborne = 1 - support
  const gather = Math.max(pulse(p, 0.27, 0.16), pulse(p, 0.4, 0.1) * 0.65)

  const bob = airborne * 0.1 - gather * 0.055
  const barrelPitch = gather * 0.07 - airborne * 0.055
  const barrelRoll = (hlW - hrW) * 0.035 + (flW - frW) * 0.02
  const neckPitch = gather * 0.11 - airborne * 0.14
  const headPitch = -neckPitch * 0.55 + gather * 0.04
  const tailPitch = airborne * 0.22 + gather * 0.08 + Math.sin(p * Math.PI * 2) * 0.12
  const tailYaw = Math.sin(p * Math.PI * 2 + 0.8) * 0.14

  const hipY = -bob * 0.7 + airborne * 0.02
  const hipZ = gather * 0.045 - airborne * 0.015
  const foldDelta = gather * 0.11 - airborne * 0.07
  const helmetPitch = -foldDelta * 0.45 - bob * 0.2
  const armGive = headPitch * 0.85 + gather * 0.05
  const thighDelta = gather * 0.14 - airborne * 0.04

  return {
    swing: { fl: fl.swing, fr: fr.swing, hl: hl.swing, hr: hr.swing },
    knee: { fl: fl.knee, fr: fr.knee, hl: hl.knee, hr: hr.knee },
    bob,
    gather,
    airborne,
    barrelPitch,
    barrelRoll,
    neckPitch,
    headPitch,
    tailPitch,
    tailYaw,
    hipY,
    hipZ,
    foldDelta,
    helmetPitch,
    armGive,
    thighDelta,
  }
}

/** Diagonal 1 (FL+HR) contacts at 0; diagonal 2 (FR+HL) at 0.5. */
const TROT_D1 = 0.0
const TROT_D2 = 0.5
const TROT_STANCE = 0.42

export function sampleTrot(phase: number): GallopSample {
  const p = wrap01(phase)
  const fl = trotLimb(p, TROT_D1, false)
  const hr = trotLimb(p, TROT_D1, true)
  const fr = trotLimb(p, TROT_D2, false)
  const hl = trotLimb(p, TROT_D2, true)

  const d1 = stanceWeight(p, TROT_D1, TROT_STANCE, 0.05)
  const d2 = stanceWeight(p, TROT_D2, TROT_STANCE, 0.05)
  const support = Math.max(d1, d2)
  const airborne = 1 - support
  const nod = Math.sin(p * Math.PI * 2) 
  const bob = nod * 0.028 + airborne * 0.04
  const barrelPitch = -nod * 0.03 + airborne * 0.02
  const barrelRoll = (d1 - d2) * 0.025
  const neckPitch = -nod * 0.06
  const headPitch = nod * 0.05
  const tailPitch = 0.18 + nod * 0.08
  const tailYaw = Math.sin(p * Math.PI * 2 + 1.1) * 0.1

  // Posting trot: rise with diagonal 1.
  const hipY = d1 * 0.035 - d2 * 0.01 + airborne * 0.015
  const hipZ = 0.01
  const foldDelta = 0.04 + d1 * 0.05
  const helmetPitch = -foldDelta * 0.3 - bob * 0.15
  const armGive = nod * 0.08
  const thighDelta = d1 * 0.08 - d2 * 0.03

  return {
    swing: { fl: fl.swing, fr: fr.swing, hl: hl.swing, hr: hr.swing },
    knee: { fl: fl.knee, fr: fr.knee, hl: hl.knee, hr: hr.knee },
    bob,
    gather: d1 * 0.35,
    airborne,
    barrelPitch,
    barrelRoll,
    neckPitch,
    headPitch,
    tailPitch,
    tailYaw,
    hipY,
    hipZ,
    foldDelta,
    helmetPitch,
    armGive,
    thighDelta,
  }
}

function lerpNum(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

function lerpLegs(a: Record<LegId, number>, b: Record<LegId, number>, u: number): Record<LegId, number> {
  return {
    fl: lerpNum(a.fl, b.fl, u),
    fr: lerpNum(a.fr, b.fr, u),
    hl: lerpNum(a.hl, b.hl, u),
    hr: lerpNum(a.hr, b.hr, u),
  }
}

export function lerpGait(a: GallopSample, b: GallopSample, u: number): GallopSample {
  const t = u < 0 ? 0 : u > 1 ? 1 : u
  return {
    swing: lerpLegs(a.swing, b.swing, t),
    knee: lerpLegs(a.knee, b.knee, t),
    bob: lerpNum(a.bob, b.bob, t),
    gather: lerpNum(a.gather, b.gather, t),
    airborne: lerpNum(a.airborne, b.airborne, t),
    barrelPitch: lerpNum(a.barrelPitch, b.barrelPitch, t),
    barrelRoll: lerpNum(a.barrelRoll, b.barrelRoll, t),
    neckPitch: lerpNum(a.neckPitch, b.neckPitch, t),
    headPitch: lerpNum(a.headPitch, b.headPitch, t),
    tailPitch: lerpNum(a.tailPitch, b.tailPitch, t),
    tailYaw: lerpNum(a.tailYaw, b.tailYaw, t),
    hipY: lerpNum(a.hipY, b.hipY, t),
    hipZ: lerpNum(a.hipZ, b.hipZ, t),
    foldDelta: lerpNum(a.foldDelta, b.foldDelta, t),
    helmetPitch: lerpNum(a.helmetPitch, b.helmetPitch, t),
    armGive: lerpNum(a.armGive, b.armGive, t),
    thighDelta: lerpNum(a.thighDelta, b.thighDelta, t),
  }
}

/**
 * Live race pace is ~0.85–1.35. Trot holds through the body of the race;
 * stretch kick (pace ≳ 1.18) blends into the existing gallop.
 */
export function sampleLocomotion(phase: number, pace: number): GallopSample {
  if (pace <= 0.08) return GATE_POSE
  const trot = sampleTrot(phase)
  if (pace < 1.05) return trot
  const gallop = sampleGallop(phase)
  if (pace >= 1.2) return gallop
  return lerpGait(trot, gallop, smooth01((pace - 1.05) / 0.15))
}

/** True when that diagonal is in weight-bearing mid-stance (not reaching). */
function diagonalSupport(
  foreKnee: number,
  hindKnee: number,
  foreSwing: number,
  hindSwing: number,
): boolean {
  return foreKnee < 0.5 && hindKnee < 0.5 && foreSwing > -0.2 && hindSwing > -0.2
}

export function trotDiagonal1Support(pose: GallopSample): boolean {
  return diagonalSupport(pose.knee.fl, pose.knee.hr, pose.swing.fl, pose.swing.hr)
}

export function trotDiagonal2Support(pose: GallopSample): boolean {
  return diagonalSupport(pose.knee.fr, pose.knee.hl, pose.swing.fr, pose.swing.hl)
}
