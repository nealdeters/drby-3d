import { countCarouselPoles, sampleGallop, wrap01 } from '../src/components/race/gallop.ts'

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
