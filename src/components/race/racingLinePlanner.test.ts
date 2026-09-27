import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseRacingLines, type RacingLineHorse } from './racingLinePlanner'

function horse(overrides: Partial<RacingLineHorse> & Pick<RacingLineHorse, 'id'>): RacingLineHorse {
  return {
    id: overrides.id,
    progress: overrides.progress ?? 0.4,
    radial: overrides.radial ?? 0.4,
    laneRadial: overrides.laneRadial ?? 0.4,
    speed: overrides.speed ?? 0.04,
    strategy: overrides.strategy ?? 'balanced',
  }
}

test('horses with open running room steer toward the shorter inside line', () => {
  const [decision] = chooseRacingLines([horse({ id: 'outer', radial: 0.75, laneRadial: 0.75 })])
  assert.equal(decision.decision, 'inside')
  assert.ok(decision.desiredRadial < decision.currentRadial)
  assert.match(decision.reason, /inside/)
})

test('a faster horse attempts an inside pass around a same-line blocker', () => {
  const decisions = chooseRacingLines([
    horse({ id: 'follower', progress: 0.40, radial: -0.25, laneRadial: -0.25, speed: 0.05 }),
    horse({ id: 'blocker', progress: 0.435, radial: -0.25, laneRadial: -0.25, speed: 0.035 }),
  ])
  const follower = decisions.find((d) => d.horseId === 'follower')!
  assert.equal(follower.blockerId, 'blocker')
  assert.equal(follower.decision, 'pass')
  assert.ok(follower.desiredRadial < follower.currentRadial)
})

test('an occupied inside line delays the move instead of cutting through a rival', () => {
  const decisions = chooseRacingLines([
    horse({ id: 'follower', progress: 0.40, radial: -0.10, laneRadial: -0.10, speed: 0.05 }),
    horse({ id: 'blocker', progress: 0.435, radial: -0.10, laneRadial: -0.10, speed: 0.035 }),
    horse({ id: 'inside', progress: 0.41, radial: -0.38, laneRadial: -0.38, speed: 0.04 }),
    horse({ id: 'outside', progress: 0.41, radial: 0.18, laneRadial: 0.18, speed: 0.04 }),
  ])
  const follower = decisions.find((d) => d.horseId === 'follower')!
  assert.equal(follower.blockerId, 'blocker')
  assert.equal(follower.decision, 'hold')
  assert.equal(follower.targetSpaceAvailable, false)
  assert.match(follower.reason, /occupied/)
})

test('a blocked rail sends a faster horse around the outside', () => {
  const decisions = chooseRacingLines([
    horse({ id: 'follower', progress: 0.40, radial: 0, laneRadial: 0, speed: 0.05 }),
    horse({ id: 'blocker', progress: 0.44, radial: 0, laneRadial: 0, speed: 0.035 }),
    horse({ id: 'rail-rival', progress: 0.43, radial: -0.28, laneRadial: -0.28, speed: 0.04 }),
  ])
  const follower = decisions.find((d) => d.horseId === 'follower')!
  assert.equal(follower.decision, 'outside')
  assert.equal(follower.blockerId, 'blocker')
  assert.ok(follower.desiredRadial > follower.currentRadial)
})
