import * as THREE from 'three'

/** Parametric oval in XZ plane. progress 0–1 around the track. */
export function ovalPoint(
  progress: number,
  radiusX = 18,
  radiusZ = 10,
): THREE.Vector3 {
  const t = progress * Math.PI * 2
  // Start at outside middle of near stretch (facing +X from grandstand at -Z)
  const x = Math.sin(t) * radiusX
  const z = -Math.cos(t) * radiusZ
  return new THREE.Vector3(x, 0, z)
}

export function ovalTangent(progress: number, radiusX = 18, radiusZ = 10): THREE.Vector3 {
  const eps = 0.001
  const a = ovalPoint(progress, radiusX, radiusZ)
  const b = ovalPoint((progress + eps) % 1, radiusX, radiusZ)
  return b.sub(a).normalize()
}

export function laneProgress(base: number, lane: number, lanes: number): number {
  // Slight stagger so horses aren't perfectly stacked
  const offset = (lane / lanes) * 0.012
  return (base + offset) % 1
}

export function laneRadii(lane: number, lanes: number): { rx: number; rz: number } {
  const spread = 1.1
  const mid = (lanes - 1) / 2
  const d = (lane - mid) * spread
  return { rx: 18 + d * 0.55, rz: 10 + d * 0.35 }
}
