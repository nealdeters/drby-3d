import * as THREE from 'three'

/** Centerline of the dirt path (XZ oval). Slightly larger for grandstand overview. */
export const TRACK = {
  centerRx: 20,
  centerRz: 11.5,
  /** Half-width of racing surface from centerline toward rails */
  halfWidth: 3.6,
  /** Inner / outer rail radii (for geometry + clamps) */
  innerRx: 16.2,
  innerRz: 7.7,
  outerRx: 23.8,
  outerRz: 15.3,
} as const

/** Parametric oval in XZ plane. progress 0–1 around the track. */
export function ovalPoint(
  progress: number,
  radiusX: number = TRACK.centerRx,
  radiusZ: number = TRACK.centerRz,
): THREE.Vector3 {
  const t = progress * Math.PI * 2
  // t=0: far backstretch (-Z); t=0.5: near stretch toward grandstand (+Z)
  // Negative X sin → counter-clockwise when viewed from above (US / Churchill standard).
  // progress↑: far → left (−X) → near → right (+X) → far
  const x = -Math.sin(t) * radiusX
  const z = -Math.cos(t) * radiusZ
  return new THREE.Vector3(x, 0, z)
}

export function ovalTangent(
  progress: number,
  radiusX: number = TRACK.centerRx,
  radiusZ: number = TRACK.centerRz,
): THREE.Vector3 {
  const eps = 0.001
  const a = ovalPoint(progress, radiusX, radiusZ)
  const b = ovalPoint((progress + eps) % 1, radiusX, radiusZ)
  return b.sub(a).normalize()
}

/**
 * Radial offset −1 (inner rail) … +1 (outer rail) mapped onto the dirt ring.
 * Returns world position on the racing surface.
 */
export function trackPoint(progress: number, radialOffset: number): THREE.Vector3 {
  const r = THREE.MathUtils.clamp(radialOffset, -1, 1)
  const rx = TRACK.centerRx + r * TRACK.halfWidth * 0.95
  const rz = TRACK.centerRz + r * TRACK.halfWidth * 0.55
  return ovalPoint(progress, rx, rz)
}

export function trackTangent(progress: number, radialOffset: number): THREE.Vector3 {
  const r = THREE.MathUtils.clamp(radialOffset, -1, 1)
  const rx = TRACK.centerRx + r * TRACK.halfWidth * 0.95
  const rz = TRACK.centerRz + r * TRACK.halfWidth * 0.55
  return ovalTangent(progress, rx, rz)
}

/** True on the banked ends of the oval (left/right turns). */
export function isOnTurn(progress: number): boolean {
  const p = ((progress % 1) + 1) % 1
  // Turns near progress 0.25 (left / −X) and 0.75 (right / +X) in CCW layout
  const d1 = Math.abs(p - 0.25)
  const d2 = Math.abs(p - 0.75)
  return Math.min(d1, d2) < 0.14
}

export type RacePhase = 'bunch' | 'jockey' | 'stretch'

/** Phase from race clock progress 0–1 (one lap). */
export function racePhase(lapProgress: number): RacePhase {
  const p = ((lapProgress % 1) + 1) % 1
  if (p < 0.22) return 'bunch'
  if (p < 0.8) return 'jockey'
  return 'stretch'
}

export type HorseSimState = {
  progress: number
  radial: number
  radialVel: number
  /** Instantaneous lap speed multiplier */
  pace: number
}

/** Seed starting pack: staggered at the gate on the near stretch. */
export function createFieldState(count: number, speedBiases: number[]): HorseSimState[] {
  return Array.from({ length: count }, (_, i) => {
    const mid = (count - 1) / 2
    // Start near progress 0.48 (just before near-stretch finish line area), slight stagger
    const gateProgress = 0.48 - (i / count) * 0.018
    const radial = THREE.MathUtils.clamp((i - mid) / Math.max(mid, 1) * 0.55, -0.85, 0.85)
    return {
      progress: gateProgress,
      radial,
      radialVel: 0,
      pace: speedBiases[i] ?? 1,
    }
  })
}

/** Advance progress by a non-negative lap fraction (forward-only along the oval). */
export function advanceProgress(progress: number, delta: number): number {
  const d = Math.max(0, delta)
  return progress + d
}

/**
 * Step the whole field together so horses pack, draft, and avoid stacking.
 * `dt` in seconds; `lapBaseSpeed` is fraction of lap per second at pace=1.
 */
export function stepField(
  states: HorseSimState[],
  dt: number,
  lapBaseSpeed = 1 / 30,
): void {
  const n = states.length
  if (n === 0) return

  // Leader progress for drafting / phase (unwrap-ish: max progress)
  let leader = states[0].progress
  for (let i = 1; i < n; i++) {
    if (states[i].progress > leader) leader = states[i].progress
  }
  // Use fractional lap for phase (race loops)
  const phaseProg = ((leader % 1) + 1) % 1
  const phase = racePhase(phaseProg)

  // Desired radials + pace tweaks
  const desired: number[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const s = states[i]
    const p = ((s.progress % 1) + 1) % 1
    const onTurn = isOnTurn(p)

    let target = s.radial
    if (phase === 'bunch') {
      // Compress toward centerline / slight inside
      target = THREE.MathUtils.lerp(s.radial, -0.15 + (i % 3) * 0.12, 0.4)
    } else if (phase === 'jockey') {
      // Prefer inside on turns; weave / draft off-turn
      if (onTurn) {
        target = -0.55 + (i % 4) * 0.12
      } else {
        // Oscillate lane choice so they jockey
        const weave = Math.sin(s.progress * Math.PI * 2 * 1.7 + i * 1.3) * 0.45
        target = weave + (i % 2 === 0 ? -0.2 : 0.25)
      }
      // Draft: if someone is just ahead, tuck toward their radial
      for (let j = 0; j < n; j++) {
        if (j === i) continue
        let dp = states[j].progress - s.progress
        // normalize small gap ahead
        if (dp < 0) dp += 1
        if (dp > 0.002 && dp < 0.04) {
          target = THREE.MathUtils.lerp(target, states[j].radial, 0.55)
          break
        }
      }
    } else {
      // Stretch: spread out, faster horses push wider or hold inside for run
      const spread = ((i / Math.max(n - 1, 1)) * 2 - 1) * 0.75
      target = spread
      if (onTurn) target = Math.min(target, -0.25)
    }

    desired[i] = THREE.MathUtils.clamp(target, -0.92, 0.92)

    // Pace: stretch kick for higher pace horses; mid draft slight boost when tucked
    let paceMul = 1
    if (phase === 'bunch') paceMul = 0.92
    else if (phase === 'jockey') paceMul = 1
    else paceMul = 1.08 + (s.pace - 1) * 0.5
    if (onTurn && s.radial < -0.2) paceMul *= 1.03 // inside path shorter feel

    const delta = Math.max(0, lapBaseSpeed * Math.max(0.01, s.pace) * Math.max(0.01, paceMul) * dt)
    s.progress = advanceProgress(s.progress, delta)
  }

  // Separation: when two horses near same progress, ease radial apart.
  // Never decrease progress — jockeying is radial-only; longitudinal is forward-only.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let dp = Math.abs(states[i].progress - states[j].progress)
      dp = Math.min(dp, 1 - (dp % 1))
      if (dp > 0.028) continue
      const dr = states[i].radial - states[j].radial
      const push = (0.028 - dp) / 0.028
      if (Math.abs(dr) < 0.22) {
        const dir = dr >= 0 ? 1 : -1
        const force = (0.22 - Math.abs(dr) + 0.05) * push * 1.8
        desired[i] = THREE.MathUtils.clamp(desired[i] + dir * force, -0.92, 0.92)
        desired[j] = THREE.MathUtils.clamp(desired[j] - dir * force, -0.92, 0.92)
        // Nudge the ahead horse slightly farther forward (never reverse anyone)
        if (states[i].progress >= states[j].progress) {
          states[i].progress += 0.0008 * push
        } else {
          states[j].progress += 0.0008 * push
        }
      }
    }
  }

  // Smooth radial motion toward desired; clamp pace/progress so horses never reverse
  for (let i = 0; i < n; i++) {
    const s = states[i]
    const err = desired[i] - s.radial
    s.radialVel = THREE.MathUtils.lerp(s.radialVel, err * 2.4, 1 - Math.exp(-dt * 6))
    s.radial = THREE.MathUtils.clamp(s.radial + s.radialVel * dt, -0.95, 0.95)
    // Soft damp
    s.radialVel *= Math.exp(-dt * 1.2)
    // Guard: pace must stay positive; progress only moves forward along the oval
    if (!(s.pace > 0)) s.pace = 0.85
    if (!Number.isFinite(s.progress)) s.progress = 0
  }
}
