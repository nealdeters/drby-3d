// Smoke the pure motion helpers (copied from trackMath.ts, no THREE).
function fracProgress(progress) {
  if (!Number.isFinite(progress)) return 0
  return ((progress % 1) + 1) % 1
}
const GATE_OVAL = 0.5
const MAX_OVERALL_RATE = 0.12
const MAX_SAMPLE_JUMP = 0.03
const MAX_OVAL_STEP = 0.012
function overallToOvalProgress(overall, laps) {
  const L = laps > 0 ? laps : 1
  const o = Number.isFinite(overall) ? Math.max(0, overall) : 0
  const lapFrac = ((((o * L) % 1) + 1) % 1)
  return (lapFrac + GATE_OVAL) % 1
}
function onStartWire(progress, eps = 0.02) {
  const p = fracProgress(progress)
  const d = Math.abs(p - GATE_OVAL)
  return d <= eps || d >= 1 - eps
}
function ovalForwardDelta(cur, tgt) {
  let delta = fracProgress(tgt) - fracProgress(cur)
  if (delta < 0) delta += 1
  return delta
}
function advanceProgress(progress, delta) {
  return progress + Math.max(0, delta)
}
function followOvalToward(s, tgt, dt, followRate, overall) {
  const cur = fracProgress(s.progress)
  let delta = ovalForwardDelta(cur, tgt)
  if (delta > 0.92) {
    if (onStartWire(cur) && overall > 0.05) {
      s.progress = Math.floor(s.progress) + fracProgress(tgt)
      return { delta: 0, snapped: true }
    }
    if (!onStartWire(cur)) {
      delta = 0
    }
  }
  const want = delta * Math.min(1, Math.max(0, dt) * followRate)
  const step = Math.min(want, MAX_OVAL_STEP)
  s.progress = advanceProgress(s.progress, step)
  return { delta, snapped: false, step }
}
function overallRateFromSamples(prev, next, dtSec) {
  if (!(dtSec > 0.015) || next + 1e-6 < prev) return undefined
  const jump = next - prev
  if (jump > MAX_SAMPLE_JUMP) return undefined
  const rate = jump / dtSec
  if (!Number.isFinite(rate) || rate < 0) return undefined
  return Math.min(rate, MAX_OVERALL_RATE)
}
function coastOverall(last, rate, ageSec, racing) {
  if (!racing || !(last >= 0) || last >= 0.999) return last
  if (!(typeof rate === 'number') || rate <= 0) return last
  const coast = Math.min(Math.max(0, ageSec), 1.25) * rate
  return Math.min(0.998, last + coast)
}

const fail = []
function assert(name, cond, extra) {
  if (!cond) fail.push(name + (extra ? ' ' + extra : ''))
  else console.log('ok', name, extra ?? '')
}

{
  const s = { progress: GATE_OVAL }
  const overall = 0.93
  const tgt = overallToOvalProgress(overall, 1)
  const r = followOvalToward(s, tgt, 1 / 60, 14, overall)
  assert('late-join 1-lap 0.93 snaps off wire', r.snapped && !onStartWire(s.progress), `tgt=${tgt.toFixed(3)} pos=${fracProgress(s.progress).toFixed(3)}`)
}
{
  const s = { progress: GATE_OVAL }
  const overall = 0.48
  const tgt = overallToOvalProgress(overall, 2)
  const r = followOvalToward(s, tgt, 1 / 60, 14, overall)
  assert('late-join 2-lap end-lap1 snaps', r.snapped && Math.abs(fracProgress(s.progress) - tgt) < 1e-9, `tgt=${tgt.toFixed(3)} pos=${fracProgress(s.progress).toFixed(3)}`)
}

{
  const s = { progress: 0.60 }
  const tgt = 0.59
  const before = s.progress
  const r = followOvalToward(s, tgt, 1 / 60, 14, 0.1)
  assert('wrap-noise hold off wire', !r.snapped && s.progress === before, `delta=${r.delta} pos=${s.progress}`)
}

{
  const s = { progress: GATE_OVAL }
  const overall = 0.001
  const tgt = overallToOvalProgress(overall, 1)
  const r = followOvalToward(s, tgt, 1 / 60, 14, overall)
  assert('gate overall 0.001 stays near wire', !r.snapped && onStartWire(s.progress), `pos=${fracProgress(s.progress).toFixed(4)} tgt=${tgt.toFixed(4)}`)
}

{
  const tgt = overallToOvalProgress(1, 1)
  assert('finish oval is wire', Math.abs(tgt - GATE_OVAL) < 1e-9, `tgt=${tgt}`)
  const s = { progress: 0.5 }
  followOvalToward(s, tgt, 1 / 60, 14, 1)
  assert('finish stay on wire', onStartWire(s.progress), `pos=${s.progress}`)
}

{
  const c = coastOverall(0.4, 0.033, 0.5, true)
  assert('coast 0.5s at 0.033', Math.abs(c - (0.4 + 0.5 * 0.033)) < 1e-9, `c=${c}`)
  const cap = coastOverall(0.4, 0.033, 5, true)
  assert('coast cap 1.25s', Math.abs(cap - (0.4 + 1.25 * 0.033)) < 1e-9, `c=${cap}`)
  const idle = coastOverall(0.4, 0.033, 0.5, false)
  assert('no coast when not racing', idle === 0.4)
  const done = coastOverall(0.999, 0.033, 0.5, true)
  assert('no coast at finish', done === 0.999)
}

function isRewind(sample, prev) {
  return typeof prev === 'number' && sample + 0.002 < prev && prev < 0.998
}
assert('leftover 0.4 vs 0 is rewind', isRewind(0, 0.4))
assert('finish 1.0 vs 0 is NOT rewind (new race sample accepted)', !isRewind(0, 1))
assert('stale 0.99 vs 0.98 is rewind', isRewind(0.98, 0.99))

{
  const rate = overallRateFromSamples(0, 0.4, 0.04)
  assert('snapshot jump does not become a rate', rate === undefined, `rate=${rate}`)
  const coast = coastOverall(0.4, undefined, 1.25, true)
  assert('no coast after jump without rate', coast === 0.4, `coast=${coast}`)
}

{
  const rate = overallRateFromSamples(0.10, 0.10165, 0.05)
  assert('normal tick rate ~0.033', rate > 0.03 && rate < 0.04, `rate=${rate}`)
}

{
  const s = { progress: 0.51 }
  const r = followOvalToward(s, 0.90, 1 / 60, 14, 0.4)
  assert('catch-up step capped', r.step <= MAX_OVAL_STEP + 1e-12, `step=${r.step}`)
  assert('catch-up did not teleport', fracProgress(s.progress) < 0.53, `pos=${s.progress}`)
}



function compressOverallToPack(overall, leaderOverall, laps) {
  if (!(leaderOverall > 0) || !(overall >= 0) || overall >= leaderOverall) return overall
  if (overall >= 0.999 || leaderOverall >= 0.999) return overall
  const L = laps > 0 ? laps : 1
  const lapGap = (leaderOverall - overall) * L
  const shownLap = Math.tanh(lapGap / 0.14) * 0.11
  return leaderOverall - shownLap / L
}
function crossedFinish(overall) {
  return typeof overall === 'number' && overall >= 0.999
}
function parkAtFinish(s, dt, followRate) {
  followOvalToward(s, GATE_OVAL, dt, followRate, 1)
  if (onStartWire(s.progress, 0.015)) {
    s.progress = Math.floor(s.progress) + GATE_OVAL
    s.pace = 0
    return true
  }
  s.pace = 0.45
  return false
}

assert('crossedFinish 1', crossedFinish(1))
assert('crossedFinish 0.998 not yet', !crossedFinish(0.998))
{
  const s = { progress: 0.45, pace: 1.1 }
  let parked = false
  for (let i = 0; i < 80; i++) parked = parkAtFinish(s, 1 / 60, 14)
  assert('finish jog reaches wire idle', parked && onStartWire(s.progress) && s.pace === 0, `pos=${fracProgress(s.progress)} pace=${s.pace}`)
}
{
  const s = { progress: GATE_OVAL, pace: 1.2 }
  parkAtFinish(s, 1 / 60, 14)
  assert('already on wire stops immediately', s.pace === 0 && onStartWire(s.progress))
}


{
  const lead = 0.80
  const a = compressOverallToPack(0.80, lead, 3)
  const b = compressOverallToPack(0.70, lead, 3)
  const c = compressOverallToPack(0.50, lead, 3)
  assert('leader uncompressed', a === lead)
  assert('trailer stays behind', b < lead && c < b)
  const bLap = (lead - b) * 3
  const cLap = (lead - c) * 3
  assert('3-lap half-race deficit still under 0.12 lap on oval', cLap < 0.12, `cLap=${cLap}`)
  assert('order preserved', bLap < cLap)
}
{
  assert('no compress at finish', compressOverallToPack(0.95, 1, 3) === 0.95)
}

if (fail.length) {
  console.error('FAIL', fail)
  process.exit(1)
}
console.log('all smoke ok')
