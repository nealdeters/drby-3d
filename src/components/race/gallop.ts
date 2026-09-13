/**
 * Left-lead transverse gallop shared by Race boxes and the TV GLB shader.
 *
 * One cycle is four footfalls then a real suspension:
 *   trailing hind (HR) → lead hind (HL) → trailing fore (FR) → lead fore (FL) → airborne.
 * Stance is short; the gathered beat (legs under) and the extended airborne beat
 * drive body / neck opposition and the jockey's two-point post.
 *
 * Hip swing: +X rotation sends a downward limb toward -Z (aft) when the horse
 * faces +Z, so +swing is the stance push and −swing is the forward reach.
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
  knee: { fl: 0, fr: 0, hl: 0, hr: 0 },
  bob: 0,
  gather: 0,
  airborne: 0,
  barrelPitch: 0,
  barrelRoll: 0,
  neckPitch: 0,
  headPitch: 0,
  tailPitch: 0,
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

function smooth01(u: number): number {
  const x = u < 0 ? 0 : u > 1 ? 1 : u
  return x * x * (3 - 2 * x)
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

function limb(
  phase: number,
  stanceStart: number,
  hind: boolean,
): { swing: number; knee: number } {
  const reach = hind ? 0.7 : 0.58
  const push = hind ? 0.86 : 0.7
  const kneeStance = hind ? 0.2 : 0.14
  const kneeSwing = hind ? 1.12 : 1.22

  const p = wrap01(phase)
  const a = wrap01(stanceStart)
  let d = p - a
  if (d < 0) d += 1

  if (d < STANCE) {
    const u = smooth01(d / STANCE)
    return {
      swing: -reach + (push + reach) * u,
      knee: kneeStance + u * 0.16,
    }
  }
  const u = smooth01((d - STANCE) / (1 - STANCE))
  const tuck = Math.sin(u * Math.PI)
  const swing = push + (-reach - push) * u
  return {
    swing: swing * (1 - 0.32 * tuck),
    knee: kneeStance + tuck * kneeSwing,
  }
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
