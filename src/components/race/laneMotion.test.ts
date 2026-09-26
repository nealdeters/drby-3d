import assert from 'node:assert/strict'
import test from 'node:test'
import { laneToRadial, moveRadialToward } from './laneMotion'

test('laneToRadial puts lane one on the inside and higher lanes outside', () => {
  const inside = laneToRadial(1, 8)
  const middle = laneToRadial(4, 8)
  const outside = laneToRadial(8, 8)

  assert.equal(inside, -0.85)
  assert.ok(inside < middle)
  assert.ok(middle < outside)
})

test('laneToRadial clamps invalid and over-wide lane values', () => {
  assert.equal(laneToRadial(0, 8), -0.85)
  assert.equal(laneToRadial(Number.NaN, 8), -0.85)
  assert.equal(laneToRadial(99, 8), 0.92)
})

test('moveRadialToward transitions toward a changed lane without teleporting', () => {
  const first = moveRadialToward(-0.85, 0.85, 1 / 60)
  const settled = moveRadialToward(first, 0.85, 1)

  assert.ok(first > -0.85)
  assert.ok(first < 0.85)
  assert.ok(settled > first)
  assert.ok(settled < 0.85)
})
