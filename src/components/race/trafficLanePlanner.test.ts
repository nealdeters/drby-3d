import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseTrafficLanes, type TrafficHorse } from './trafficLanePlanner'

function pick(horses: TrafficHorse[], id: string) {
  return chooseTrafficLanes(horses, 8).find((decision) => decision.horseId === id)!
}

test('an unobstructed runner takes the shorter inside line', () => {
  const decision = pick(
    [
      { id: 'outer', progress: 0.30, lane: 4, speed: 0.035, strategy: 'balanced' },
      { id: 'far', progress: 0.10, lane: 8, speed: 0.03, strategy: 'balanced' },
    ],
    'outer',
  )
  assert.equal(decision.targetLane, 3)
  assert.equal(decision.reason, 'inside line available')
  assert.ok(decision.insideLineAdvantage > 0)
})

test('a faster horse passes inside when the rail has room', () => {
  const decision = pick(
    [
      { id: 'slow', progress: 0.52, lane: 3, speed: 0.02 },
      { id: 'passer', progress: 0.49, lane: 3, speed: 0.04 },
    ],
    'passer',
  )
  assert.equal(decision.targetLane, 2)
  assert.equal(decision.blockerId, 'slow')
  assert.match(decision.reason, /inside pass/)
})

test('a horse goes outside when the inside lane is occupied', () => {
  const decision = pick(
    [
      { id: 'slow', progress: 0.52, lane: 3, speed: 0.02 },
      { id: 'rail', progress: 0.50, lane: 2, speed: 0.03 },
      { id: 'passer', progress: 0.49, lane: 3, speed: 0.04 },
    ],
    'passer',
  )
  assert.equal(decision.targetLane, 4)
  assert.equal(decision.targetSpaceAvailable, true)
  assert.match(decision.reason, /outside/)
})

test('a horse holds when both passing lanes are occupied', () => {
  const decision = pick(
    [
      { id: 'slow', progress: 0.52, lane: 3, speed: 0.02 },
      { id: 'rail', progress: 0.50, lane: 2, speed: 0.03 },
      { id: 'outside', progress: 0.50, lane: 4, speed: 0.03 },
      { id: 'passer', progress: 0.49, lane: 3, speed: 0.04 },
    ],
    'passer',
  )
  assert.equal(decision.targetLane, 3)
  assert.equal(decision.targetSpaceAvailable, false)
  assert.match(decision.reason, /occupied/)
})
