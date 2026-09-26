const MIN_RADIAL = -0.92
const MAX_RADIAL = 0.92

/** Map scheduler lane numbers to the 3D racing line (1 is the inside rail). */
export function laneToRadial(lane: number, horseCount: number): number {
  const normalizedLane = Number.isFinite(lane) && lane > 0 ? lane : 1
  const count = Math.max(horseCount, 8)
  const radial = ((normalizedLane - 1) / Math.max(count - 1, 1)) * 1.7 - 0.85
  return Math.max(MIN_RADIAL, Math.min(MAX_RADIAL, radial))
}

/** Smooth a horse onto a newly selected lane without teleporting across the track. */
export function moveRadialToward(current: number, target: number, deltaSeconds: number, rate = 4.5): number {
  if (!Number.isFinite(target)) return current
  const dt = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0)
  const alpha = 1 - Math.exp(-Math.max(0, rate) * dt)
  return current + (target - current) * alpha
}
