import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CHASE_BACK,
  CHASE_HEIGHT,
  DEFAULT_VIEW,
  FOLLOW_AERIAL_HEIGHT,
  VIEW_AERIAL,
  VIEW_CHASE,
  VIEW_MODES,
  VIEW_ON_TRACK,
  aerialShot,
  chaseShot,
  followAerialShot,
  packShot,
} from './cameraViews'
import { shotKind, viewSubjectId } from './cameraDirector'

describe('view modes', () => {
  it('exposes the three distinct race views', () => {
    assert.deepEqual(
      VIEW_MODES.map((m) => m.id),
      [VIEW_AERIAL, VIEW_ON_TRACK, VIEW_CHASE],
    )
    assert.equal(DEFAULT_VIEW, VIEW_ON_TRACK)
  })
})

describe('shotKind', () => {
  it('maps each switcher id to a distinct kind', () => {
    assert.equal(shotKind({ viewMode: VIEW_AERIAL }), 'aerial')
    assert.equal(shotKind({ viewMode: VIEW_ON_TRACK }), 'on-track')
    assert.equal(shotKind({ viewMode: VIEW_CHASE }), 'chase')
  })
})

describe('viewSubjectId', () => {
  it('uses the picked horse, else the leader, for aerial and chase', () => {
    assert.equal(viewSubjectId(['a', 'b'], 'b', VIEW_AERIAL), 'b')
    assert.equal(viewSubjectId(['a', 'b'], null, VIEW_AERIAL), 'a')
    assert.equal(viewSubjectId(['a', 'b'], null, VIEW_CHASE), 'a')
    assert.equal(viewSubjectId(['a', 'b'], null, VIEW_ON_TRACK), null)
  })
})

describe('distinct shots', () => {
  const horse = { x: 12, y: 0.7, z: -4 }
  const forward = { x: 1, y: 0, z: 0 }

  it('aerial overview and horse-follow aerial remain distinct', () => {
    const overview = aerialShot({ aspect: 16 / 9 })
    const follow = followAerialShot(horse)
    assert.equal(overview.fov, 50)
    assert.ok(overview.pos.y > follow.pos.y, `overview ${overview.pos.y} follow ${follow.pos.y}`)
    assert.notEqual(overview.pos.x.toFixed(2), follow.pos.x.toFixed(2))
  })

  it('aerial follows the horse in XY, chase sits low behind it, pack sits farther back', () => {
    const air = followAerialShot(horse)
    const chase = chaseShot(horse, forward)
    const pack = packShot([horse, { x: 10, y: 0.7, z: -4 }], { forward })

    assert.ok(Math.abs(air.pos.x - horse.x) < 0.01)
    assert.ok(Math.abs(air.pos.y - (horse.y + FOLLOW_AERIAL_HEIGHT)) < 0.01)

    assert.ok(chase.pos.y < 8, `chase height ${chase.pos.y}`)
    assert.ok(air.pos.y > chase.pos.y * 4, `aerial ${air.pos.y} chase ${chase.pos.y}`)
    assert.ok(chase.pos.x < horse.x, 'chase is behind +X travel')
    assert.ok(Math.abs(horse.x - chase.pos.x) > CHASE_BACK * 0.6)

    assert.ok(pack.pos.y > chase.pos.y + 6, `pack ${pack.pos.y} chase ${chase.pos.y}`)
    const packBack = Math.hypot(pack.pos.x - horse.x, pack.pos.z - horse.z)
    const chaseBack = Math.hypot(chase.pos.x - horse.x, chase.pos.z - horse.z)
    assert.ok(packBack > chaseBack + 8, `packBack ${packBack} chaseBack ${chaseBack}`)
    assert.ok(CHASE_HEIGHT < 8)
  })

  it('the camera shots do not share a camera position', () => {
    const aerial = aerialShot({ aspect: 16 / 9 })
    const air = followAerialShot(horse)
    const chase = chaseShot(horse, forward)
    const pack = packShot([horse], { forward })
    const keys = [aerial, air, chase, pack].map((s) => `${s.pos.x.toFixed(2)},${s.pos.y.toFixed(2)},${s.pos.z.toFixed(2)}`)
    assert.equal(new Set(keys).size, 4, keys.join(' | '))
  })
})
