export type TrafficHorse = {
  id: string
  /** Overall race progress, 0–1. */
  progress: number
  /** Fractional lane position; 1 is the inside rail. */
  lane: number
  /** Estimated overall progress per second. */
  speed: number
  /** Optional tendency from the live roster. */
  strategy?: 'aggressive' | 'conservative' | 'balanced'
}

export type TrafficLaneDecision = {
  horseId: string
  currentLane: number
  targetLane: number
  blockerId: string | null
  targetSpaceAvailable: boolean
  insideLineAdvantage: number
  decision: 'hold' | 'move'
  reason: string
}

const LOOK_AHEAD = 0.055
const LANE_CLEARANCE = 0.035
const TARGET_CLEARANCE = 0.72

function laneOf(value: number, maxLanes: number): number {
  return Math.max(1, Math.min(maxLanes, Math.round(Number.isFinite(value) ? value : 1)))
}

function forwardGap(from: number, to: number): number {
  return to - from
}

function laneOccupied(
  horse: TrafficHorse,
  lane: number,
  horses: TrafficHorse[],
  reserved: Set<number>,
): boolean {
  if (reserved.has(lane)) return true
  return horses.some((other) => {
    if (other.id === horse.id) return false
    const gap = Math.abs(other.progress - horse.progress)
    return Math.abs(other.lane - lane) < TARGET_CLEARANCE && gap < LANE_CLEARANCE
  })
}

function blockerAhead(horse: TrafficHorse, currentLane: number, horses: TrafficHorse[]): TrafficHorse | null {
  return horses
    .filter((other) => {
      if (other.id === horse.id || laneOf(other.lane, 8) !== currentLane) return false
      const gap = forwardGap(horse.progress, other.progress)
      return gap > 0 && gap <= LOOK_AHEAD
    })
    .sort((a, b) => a.progress - b.progress)[0] ?? null
}

/**
 * Choose visible, one-lane-at-a-time traffic moves when the feed has not
 * supplied a physical lane transition. This is a display-side safety net for
 * old snapshots; it is deliberately deterministic and uses only race state,
 * traffic, clearance, speed and strategy (never hidden reasoning).
 */
export function chooseTrafficLanes(
  horses: TrafficHorse[],
  maxLanes: number,
): TrafficLaneDecision[] {
  const reserved = new Set<number>()
  const decisions: TrafficLaneDecision[] = []
  // Let the horse nearer the front claim a contested lane first.
  const ordered = [...horses].sort((a, b) => b.progress - a.progress)

  for (const horse of ordered) {
    const currentLane = laneOf(horse.lane, maxLanes)
    const blocker = blockerAhead(horse, currentLane, horses)
    const hasCloseFollower = horses.some((other) => {
      if (other.id === horse.id || laneOf(other.lane, maxLanes) !== currentLane) return false
      const gap = horse.progress - other.progress
      return gap > 0 && gap <= LOOK_AHEAD
    })
    const insideLane = currentLane - 1
    const outsideLane = currentLane + 1
    const insideOpen = insideLane >= 1 && !laneOccupied(horse, insideLane, horses, reserved)
    const outsideOpen = outsideLane <= maxLanes && !laneOccupied(horse, outsideLane, horses, reserved)
    const insideLineAdvantage = Math.max(0, currentLane - 1) * 0.035
    const speedEdge = blocker ? horse.speed - blocker.speed : 0
    const canPass = Boolean(blocker && speedEdge > -0.004)

    let targetLane = currentLane
    let reason = 'hold position'
    let targetSpaceAvailable = true

    if (blocker && canPass) {
      if (insideOpen) {
        targetLane = insideLane
        reason = 'attempt inside pass around slower horse'
      } else if (outsideOpen) {
        targetLane = outsideLane
        reason = 'pass outside; inside lane occupied'
      } else {
        targetSpaceAvailable = false
        reason = 'hold behind traffic; both passing lanes occupied'
      }
    } else if (!blocker && !hasCloseFollower && insideOpen && currentLane > 1) {
      // The rail is desirable, but not at any cost. Hold lane 1, preserve
      // momentum in a contested lane, and let conservative runners wait.
      const tendency = horse.strategy === 'aggressive' ? 0.018 : horse.strategy === 'conservative' ? -0.006 : 0.008
      const wantsInside = insideLineAdvantage + tendency >= 0.038
      if (wantsInside) {
        targetLane = insideLane
        reason = 'inside line available'
      }
    } else if (currentLane > 1 && !insideOpen) {
      targetSpaceAvailable = false
      reason = 'hold position; inside lane occupied'
    }

    if (targetLane !== currentLane) reserved.add(targetLane)
    decisions.push({
      horseId: horse.id,
      currentLane,
      targetLane,
      blockerId: blocker?.id ?? null,
      targetSpaceAvailable,
      insideLineAdvantage,
      decision: targetLane === currentLane ? 'hold' : 'move',
      reason,
    })
  }

  return decisions
}
