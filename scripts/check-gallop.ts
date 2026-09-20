import {
  countCarouselPoles,
  sampleGallop,
  wrap01,
  sampleTrot,
  sampleLocomotion,
  trotDiagonal1Support,
  trotDiagonal2Support,
} from '../src/components/race/gallop.ts'

const STEPS = 200
let maxPoles = 0
let maxAirPoles = 0
let airSamples = 0
let framesWithTwoPoles = 0
let airLinger = 0

for (let i = 0; i < STEPS; i++) {
  const pose = sampleGallop(i / STEPS)
  const n = countCarouselPoles(pose)
  if (n > maxPoles) maxPoles = n
  if (pose.airborne > 0.55) {
    airSamples++
    if (n > maxAirPoles) maxAirPoles = n
  }
  if (n > 1) framesWithTwoPoles++
}

const ids = ['fl', 'fr', 'hl', 'hr'] as const
for (const id of ids) {
  let run = 0
  for (let i = 0; i < STEPS; i++) {
    const pose = sampleGallop(i / STEPS)
    const pole =
      pose.airborne > 0.5 && Math.abs(pose.swing[id]) < 0.28 && pose.knee[id] < 0.7
    run = pole ? run + 1 : 0
    if (run > 3) airLinger++
  }
}

const fail: string[] = []
if (maxPoles > 1) fail.push(`max carousel poles in a frame = ${maxPoles} (want <= 1)`)
if (maxAirPoles > 0) fail.push(`airborne carousel poles = ${maxAirPoles} (want 0)`)
if (framesWithTwoPoles > 0) fail.push(`frames with 2+ poles = ${framesWithTwoPoles}/${STEPS}`)
if (airLinger > 0) fail.push(`airborne legs lingered as poles (${airLinger} overruns)`)

console.log(
  JSON.stringify(
    { steps: STEPS, maxPoles, maxAirPoles, airSamples, framesWithTwoPoles, airLinger },
    null,
    2,
  ),
)
if (fail.length) {
  console.error(fail.join('\n'))
  process.exit(1)
}
console.log('gallop carousel check ok')

const idsDump = ['fl', 'fr', 'hl', 'hr'] as const
for (let i = 0; i < 8; i++) {
  const pose = sampleGallop(i / 8)
  const row: Record<string, unknown> = {
    phase: i / 8,
    poles: countCarouselPoles(pose),
    airborne: Number(pose.airborne.toFixed(2)),
  }
  for (const id of idsDump) {
    row[id] = { swing: Number(pose.swing[id].toFixed(3)), knee: Number(pose.knee[id].toFixed(3)) }
  }
  console.log('phase', JSON.stringify(row))
}
void wrap01

const TROT_STEPS = 200
let bothDiags = 0
let neitherDiag = 0
let d1 = 0
let d2 = 0
for (let i = 0; i < TROT_STEPS; i++) {
  const pose = sampleTrot(i / TROT_STEPS)
  const a = trotDiagonal1Support(pose)
  const b = trotDiagonal2Support(pose)
  if (a) d1++
  if (b) d2++
  if (a && b) bothDiags++
  if (!a && !b && pose.airborne < 0.35) neitherDiag++
}
const trotFail: string[] = []
if (bothDiags > 8) trotFail.push(`trot both diagonals supporting = ${bothDiags} (want mostly exclusive)`)
if (d1 < 60 || d2 < 60) trotFail.push(`trot diagonal counts d1=${d1} d2=${d2} (want each ~80+/200)`)
if (neitherDiag > 40) trotFail.push(`trot neither-diagonal mid-stance = ${neitherDiag}`)

const locGate = sampleLocomotion(0.2, 0)
const locTrot = sampleLocomotion(0.2, 0.95)
const locGallop = sampleLocomotion(0.2, 1.3)
if (Math.abs(locGate.swing.fl) > 1e-6) trotFail.push('gate locomotion should be GATE_POSE')
const same =
  Math.abs(locTrot.swing.fl - locGallop.swing.fl) < 0.02 &&
  Math.abs(locTrot.knee.fl - locGallop.knee.fl) < 0.02
if (same) trotFail.push('trot and gallop samples at phase 0.2 should differ')

console.log(JSON.stringify({ trot: { d1, d2, bothDiags, neitherDiag } }, null, 2))
if (trotFail.length) {
  console.error(trotFail.join('\n'))
  process.exit(1)
}
console.log('trot / locomotion check ok')
