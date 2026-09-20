import { TRACK } from './trackMath'

export const VIEW_AERIAL = 'aerial'
export const VIEW_ON_TRACK = 'on-track'

export const VIEW_MODES = [
  { id: VIEW_AERIAL, label: 'Aerial' },
  { id: VIEW_ON_TRACK, label: 'On track' },
] as const

export type ViewMode = (typeof VIEW_MODES)[number]['id']

/** Default opens On track (pack framing); Aerial remains available in the switcher. */
export const DEFAULT_VIEW: ViewMode = VIEW_ON_TRACK

export const AERIAL_FOV = 50
export const AERIAL_PAD = 1.28
export const AERIAL_TILT = 0.22

export const FOLLOW_AERIAL_FOV = 50
export const FOLLOW_AERIAL_HEIGHT = 58
export const FOLLOW_AERIAL_TILT = 0.14
export const FOLLOW_AERIAL_K = 0.04

export const PACK_FOV = 42
export const PACK_MAX_DIST = 90

export type Vec3 = { x: number; y: number; z: number }
export type Shot = { pos: Vec3; target: Vec3; span: number; dist: number; fov: number }

/** Churchill oval bounds including stands / spires margin. */
export function circuitBounds() {
  const minX = -TRACK.outerRx - 8
  const maxX = TRACK.outerRx + 8
  const minZ = -TRACK.outerRz - 10
  const maxZ = TRACK.outerRz + 14
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const span = Math.max(maxX - minX, maxZ - minZ)
  return { cx, cz, span, minX, maxX, minZ, maxZ }
}

export function aerialShot(opts: { aspect?: number; fov?: number; pad?: number; tilt?: number } = {}): Shot {
  const { cx, cz, span, minX, maxX, minZ, maxZ } = circuitBounds()
  const fov = opts.fov ?? AERIAL_FOV
  const aspect = Math.max(0.35, opts.aspect ?? 16 / 9)
  const pad = opts.pad ?? AERIAL_PAD
  const tilt = Number.isFinite(opts.tilt) ? (opts.tilt as number) : AERIAL_TILT
  const halfW = Math.max(8, ((maxX - minX) / 2) * pad)
  const halfD = Math.max(8, ((maxZ - minZ) / 2) * pad)
  const vFov = ((fov || AERIAL_FOV) * Math.PI) / 180
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
  const yV = halfD / Math.tan(Math.max(0.12, vFov / 2))
  const yH = halfW / Math.tan(Math.max(0.12, hFov / 2))
  const y = Math.max(36, yV, yH) * (1 + Math.abs(tilt) * 0.55)
  return {
    pos: { x: cx, y, z: cz + y * tilt },
    target: { x: cx, y: 0, z: cz },
    span,
    dist: y,
    fov,
  }
}

export function followAerialShot(target: Vec3 | null | undefined, opts: { height?: number; tilt?: number; fov?: number } = {}): Shot {
  const height = opts.height ?? FOLLOW_AERIAL_HEIGHT
  const tilt = Number.isFinite(opts.tilt) ? (opts.tilt as number) : FOLLOW_AERIAL_TILT
  const fov = opts.fov ?? FOLLOW_AERIAL_FOV
  const tx = target?.x || 0
  const ty = target?.y || 0
  const tz = target?.z || 0
  return {
    pos: { x: tx, y: ty + height, z: tz + height * tilt },
    target: { x: tx, y: ty, z: tz },
    span: circuitBounds().span,
    dist: height,
    fov,
  }
}

export function dampPoint(prev: Vec3 | null, next: Vec3 | null | undefined, k: number): Vec3 | null {
  if (!next) return prev
  if (!prev) return { x: next.x, y: next.y, z: next.z }
  const t = Math.max(0, Math.min(1, k))
  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
    z: prev.z + (next.z - prev.z) * t,
  }
}

/** Pack framing: sit behind the lead cluster. */
export function packShot(
  points: Vec3[],
  opts: { forward?: Vec3; fov?: number; aspect?: number; maxDist?: number } = {},
): Shot {
  const { span } = circuitBounds()
  if (!points.length) return aerialShot({ aspect: opts.aspect })
  let sx = 0
  let sy = 0
  let sz = 0
  for (const p of points) {
    sx += p.x
    sy += p.y
    sz += p.z
  }
  const n = points.length
  const cx = sx / n
  const cy = sy / n
  const cz = sz / n
  let fx = opts.forward?.x ?? 0
  let fz = opts.forward?.z ?? 1
  const fl = Math.hypot(fx, fz) || 1
  fx /= fl
  fz /= fl
  const back = Math.min(opts.maxDist ?? PACK_MAX_DIST, Math.max(28, span * 0.35))
  const height = Math.max(14, back * 0.42)
  return {
    pos: { x: cx - fx * back, y: cy + height, z: cz - fz * back },
    target: { x: cx + fx * 6, y: cy + 0.6, z: cz + fz * 6 },
    span,
    dist: Math.hypot(back, height),
    fov: opts.fov ?? PACK_FOV,
  }
}
