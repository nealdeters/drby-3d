import assert from 'node:assert/strict'
import test from 'node:test'
import { inferRaceUpdateType, parseRaceUpdate } from './liveRaceStart'

const racer = (progress = 0) => ({
  id: 'h1', name: 'One', color: '#fff', baseSpeed: 80, health: 1,
  strategy: 'balanced' as const, trackPreference: 'dirt' as const,
  acceleration: 1, endurance: 1, consistency: 1, staminaRecovery: 1,
  lane: 1, progress, laps: 0, totalDistance: progress, status: 'active' as const,
  currentSpeed: 80,
})

test('starts from a progress packet even when the start packet was missed', () => {
  assert.equal(inferRaceUpdateType({
    raceId: 'r1', type: 'tick', racers: [racer(0.12)],
  } as never), 'progress')
})

test('uses racer progress when progressMap is absent', () => {
  const parsed = parseRaceUpdate(JSON.stringify({
    raceId: 'r1', type: 'update', racers: [racer(0.2)],
  }))
  assert.ok(parsed)
  assert.equal(inferRaceUpdateType(parsed!), 'progress')
  assert.equal(parsed!.racers![0]!.progress, 0.2)
})

test('accepts a start packet with no optional arrays', () => {
  const parsed = parseRaceUpdate({ raceId: 'r1', type: 'started' })
  assert.ok(parsed)
  assert.equal(inferRaceUpdateType(parsed!), 'started')
})
