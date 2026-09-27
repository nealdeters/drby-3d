export type RacingLineHorse = {
  id: string
  /** Overall race progress (0..1). */
  progress: number
  /** Current continuous radial position (-1 rail .. +1 outside). */
  radial: number
  /** Coarse server lane expressed as a radial preference. */
  laneRadial: number
  /** Estimated forward rate. */
  speed: number
  strategy: 'aggressive' | 'conservative' | 'balanced'
}

export type RacingLineDecision = {
  horseId: string
  currentRadial: number
  desiredRadial: number
  insidePreference: number
  blockerId: string | null
  competingIds: string[]
  targetSpaceAvailable: boolean
  decision: 'hold' | 'inside' | 'outside' | 'pass' | 'avoid traffic'
  reason: string
}

const RAIL = -0.92
const OUTER = 0.92
const SAME_LINE = 0.31
const BODY_GAP = 0.034
const LOOK_AHEAD = 0.075
const PASS_GAP = 0.009
const TARGET_GAP = 0.17

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function forwardGap(from: number, to: number): number {
  const raw = to - from
  return raw >= 0 ? raw : raw + 1
}

function radialOccupied(
  horse: RacingLineHorse,
  target: number,
  horses: RacingLineHorse[],
  reservations: number[],
): boolean {
  if (reservations.some((value) => Math.abs(value - target) < TARGET_GAP)) return true
  return horses.some((other) => {
    if (other.id === horse.id) return false
    const gap = forwardGap(horse.progress, other.progress)
    // A rival behind is not a blocker for the move ahead; a rival ahead or
    // alongside is. This mirrors a driver steering into the open space beyond
    // a horse rather than treating every nearby body as a wall.
    const longitudinallyClose = gap < BODY_GAP
    return longitudinallyClose && Math.abs(other.radial - target) < TARGET_GAP
  })
}

function nearestAhead(
  horse: RacingLineHorse,
  horses: RacingLineHorse[],
): RacingLineHorse | null {
  return horses
    .filter((other) => {
      if (other.id === horse.id) return false
      const gap = forwardGap(horse.progress, other.progress)
      return gap > PASS_GAP && gap < LOOK_AHEAD && Math.abs(other.radial - horse.radial) < SAME_LINE
    })
    .sort((a, b) => {
      const lineDistance = Math.abs(a.radial - horse.radial) - Math.abs(b.radial - horse.radial)
      return lineDistance || forwardGap(horse.progress, a.progress) - forwardGap(horse.progress, b.progress)
    })[0] ?? null
}

/**
 * Continuous racing-line planner inspired by the grid-racer's steering model.
 * A lane is only a preference; the returned radial target is a point on the
 * track. Traffic can displace that target, reserve it, or force a hold.
 */
export function chooseRacingLines(
  horses: RacingLineHorse[],
  reservations: number[] = [],
): RacingLineDecision[] {
  const ordered = [...horses].sort((a, b) => b.progress - a.progress)
  const claimed = [...reservations]
  const decisions: RacingLineDecision[] = []

  for (const horse of ordered) {
    const insidePreference =
      horse.strategy === 'aggressive' ? 0.78 : horse.strategy === 'conservative' ? 0.52 : 0.66
    // Keep the server's lane as a weak starting preference, never as a rail.
    const lineTarget = clamp(
      horse.laneRadial * 0.22 + -insidePreference * 0.78,
      RAIL,
      OUTER,
    )
    const blocker = nearestAhead(horse, horses)
    const competitors = horses
      .filter((other) => {
        if (other.id === horse.id) return false
        return Math.min(forwardGap(horse.progress, other.progress), forwardGap(other.progress, horse.progress)) < BODY_GAP
          && Math.abs(other.radial - horse.radial) < 0.34
      })
      .map((other) => other.id)

    let desiredRadial = lineTarget
    let decision: RacingLineDecision['decision'] = 'inside'
    let reason = 'steer toward shorter inside racing line'
    let targetSpaceAvailable = true

    if (blocker && horse.speed >= blocker.speed - 0.002) {
      const insideTarget = clamp(horse.radial - 0.28, RAIL, OUTER)
      const outsideTarget = clamp(horse.radial + 0.28, RAIL, OUTER)
      const insideBlocked = radialOccupied(horse, insideTarget, horses, claimed)
      const outsideBlocked = radialOccupied(horse, outsideTarget, horses, claimed)

      // Score open options like a driver choosing a line: rail distance first,
      // then clearance and the amount of lateral movement required.
      const score = (target: number, blocked: boolean): number => {
        if (blocked) return Number.NEGATIVE_INFINITY
        const railAdvantage = (OUTER - target) * 0.8
        const momentum = 1 - Math.abs(target - horse.radial) * 0.55
        const passRoom = Math.max(0, 1 - Math.abs(target - blocker.radial) / 0.5)
        return railAdvantage + momentum + passRoom
      }
      const insideScore = score(insideTarget, insideBlocked)
      const outsideScore = score(outsideTarget, outsideBlocked)

      if (insideScore !== Number.NEGATIVE_INFINITY || outsideScore !== Number.NEGATIVE_INFINITY) {
        if (insideScore >= outsideScore) {
          desiredRadial = insideTarget
          decision = 'pass'
          reason = 'pass slower horse toward open inside line'
        } else {
          desiredRadial = outsideTarget
          decision = 'outside'
          reason = 'pass outside; inside running room occupied'
        }
      } else {
        desiredRadial = horse.radial
        decision = 'hold'
        targetSpaceAvailable = false
        reason = 'hold behind traffic; inside and outside routes occupied'
      }
    } else if (blocker) {
      desiredRadial = horse.radial
      decision = 'hold'
      targetSpaceAvailable = false
      reason = 'hold position; insufficient speed to pass safely'
    } else {
      const insideTarget = clamp(horse.radial - 0.2, RAIL, OUTER)
      if (!radialOccupied(horse, insideTarget, horses, claimed)) {
        desiredRadial = Math.abs(insideTarget - lineTarget) < Math.abs(horse.radial - lineTarget)
          ? insideTarget
          : lineTarget
        decision = 'inside'
        reason = 'inside running room available'
      } else {
        // Do not cut through a rival to reach the rail. Keep a moving target so
        // the horse can try again after the rival clears.
        desiredRadial = horse.radial
        decision = competitors.length ? 'avoid traffic' : 'hold'
        targetSpaceAvailable = false
        reason = competitors.length
          ? 'delay inside move; rival occupies preferred line'
          : 'hold position; inside running room occupied'
      }
    }

    desiredRadial = clamp(desiredRadial, RAIL, OUTER)
    // Reserve only an active passing move. Ordinary inside-line convergence is
    // allowed to produce competition; the next evaluation then sees the
    // rival's actual body position and can hold or go around.
    if (decision === 'pass' || decision === 'outside') claimed.push(desiredRadial)
    decisions.push({
      horseId: horse.id,
      currentRadial: horse.radial,
      desiredRadial,
      insidePreference,
      blockerId: blocker?.id ?? null,
      competingIds: competitors,
      targetSpaceAvailable,
      decision,
      reason,
    })
  }

  return decisions
}
