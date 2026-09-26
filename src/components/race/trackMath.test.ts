import assert from 'node:assert/strict'
import test from 'node:test'
import { continuePastFinish, GATE_OVAL, stopAfterRace, type HorseSimState } from './trackMath'

test('a finisher continues around the track at its captured pace until race completion', () => {
  const state: HorseSimState = {
    progress: GATE_OVAL,
    radial: -0.3,
    radialVel: 0,
    pace: 1,
    overallRate: 0.04,
  }
  continuePastFinish(state, 1 / 60, 1, true)
  const afterFirstFrame = state.progress
  continuePastFinish(state, 1 / 60, 1, true)

  assert.equal(state.finishCruising, true)
  assert.equal(state.finishCruiseRate, 0.04)
  assert.ok(afterFirstFrame > GATE_OVAL)
  assert.ok(state.progress > afterFirstFrame)
  assert.ok(state.pace > 0)

  stopAfterRace(state)
  const parked = state.progress
  continuePastFinish(state, 1, 1, false)
  assert.equal(state.progress, parked)
  assert.equal(state.pace, 0)
})
