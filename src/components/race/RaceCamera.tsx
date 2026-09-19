import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { raceBridge } from './raceBridge'
import {
  AERIAL_FOV,
  DEFAULT_VIEW,
  FOLLOW_AERIAL_FOV,
  FOLLOW_AERIAL_K,
  FULL_FOV,
  PACK_FOV,
  VIEW_AERIAL,
  VIEW_CHASE,
  VIEW_FULL,
  VIEW_ON_TRACK,
  aerialShot,
  dampPoint,
  followAerialShot,
  fullTrackShot,
  packShot,
  type Vec3,
  type ViewMode,
} from './cameraViews'

type Props = {
  viewMode: ViewMode
  followId: string | null
  homeNonce: number
}

function applyShot(
  camera: THREE.PerspectiveCamera,
  shot: { pos: Vec3; target: Vec3; dist: number; fov: number },
  desired: THREE.Vector3,
  desiredLook: THREE.Vector3,
  look: THREE.Vector3,
  k: number,
  span: number,
) {
  if (Number.isFinite(shot.fov) && Math.abs(camera.fov - shot.fov) > 0.2) {
    camera.fov = shot.fov
    camera.updateProjectionMatrix()
  }
  desired.set(shot.pos.x, shot.pos.y, shot.pos.z)
  camera.position.lerp(desired, k)
  desiredLook.set(shot.target.x, shot.target.y, shot.target.z)
  look.lerp(desiredLook, k)
  camera.lookAt(look)
  const far = Math.max(420, span * 5, (shot.dist || 80) * 3.2)
  if (Math.abs(camera.far - far) > 8) {
    camera.far = far
    camera.updateProjectionMatrix()
  }
}

export function RaceCamera({ viewMode, followId, homeNonce }: Props) {
  const { camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const modeRef = useRef(viewMode || DEFAULT_VIEW)
  modeRef.current = viewMode || DEFAULT_VIEW
  const followRef = useRef(followId)
  followRef.current = followId
  const look = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])
  const desiredLook = useMemo(() => new THREE.Vector3(), [])
  const userHeld = useRef(false)
  const snap = useRef(true)
  const followSmooth = useRef<Vec3 | null>(null)
  const boot = useMemo(() => aerialShot({ aspect: 16 / 9 }), [])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.near = 0.5
    cam.far = Math.max(420, boot.span * 5)
    cam.fov = modeRef.current === VIEW_FULL ? FULL_FOV : modeRef.current === VIEW_AERIAL ? FOLLOW_AERIAL_FOV : PACK_FOV
    cam.updateProjectionMatrix()
  }, [camera, boot.span, viewMode])

  useEffect(() => {
    userHeld.current = false
    snap.current = true
    followSmooth.current = null
  }, [homeNonce, viewMode])

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    const mode = modeRef.current
    const aspect = size.width / Math.max(1, size.height)
    const id = followRef.current
    const tracking = Boolean(id && raceBridge.followOk)
    const doSnap = snap.current
    const k = doSnap ? 1 : 0.14
    snap.current = false

    if (mode === VIEW_FULL) {
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const shot = fullTrackShot({ aspect, fov: FULL_FOV })
      applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
      if (controls.current) controls.current.target.lerp(look, k)
      return
    }

    if (mode === VIEW_AERIAL && tracking) {
      if (controls.current) controls.current.enabled = false
      const next = { x: raceBridge.followX, y: raceBridge.followY, z: raceBridge.followZ }
      followSmooth.current = doSnap ? next : dampPoint(followSmooth.current, next, FOLLOW_AERIAL_K)
      const shot = followAerialShot(followSmooth.current)
      applyShot(cam, shot, desired, desiredLook, look, FOLLOW_AERIAL_K, shot.span)
      if (controls.current) controls.current.target.lerp(look, FOLLOW_AERIAL_K)
      return
    }

    if (mode === VIEW_AERIAL) {
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const shot = aerialShot({ aspect, fov: AERIAL_FOV })
      applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
      if (controls.current) controls.current.target.lerp(look, k)
      return
    }

    if (tracking && (mode === VIEW_CHASE || Boolean(id))) {
      if (controls.current) controls.current.enabled = false
      const px = raceBridge.followX
      const py = raceBridge.followY
      const pz = raceBridge.followZ
      const hx = raceBridge.followHX
      const hz = raceBridge.followHZ
      const len = Math.hypot(hx, hz) || 1
      const fx = hx / len
      const fz = hz / len
      const sx = -fz
      const sz = fx
      if (Math.abs(cam.fov - PACK_FOV) > 0.2) {
        cam.fov = PACK_FOV
        cam.updateProjectionMatrix()
      }
      desired.set(px - fx * 9 + sx * 3.2, py + 3.4, pz - fz * 9 + sz * 3.2)
      look.set(px + fx * 5.5, py + 0.35, pz + fz * 5.5)
      cam.position.lerp(desired, 0.12)
      cam.lookAt(look)
      if (controls.current) controls.current.target.lerp(look, 0.12)
      return
    }

    if (mode === VIEW_ON_TRACK) {
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const pts = raceBridge.packPoints
      if (!pts.length) {
        const shot = aerialShot({ aspect })
        applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
        return
      }
      if (Math.abs(cam.fov - PACK_FOV) > 0.2) {
        cam.fov = PACK_FOV
        cam.updateProjectionMatrix()
      }
      const shot = packShot(pts, {
        forward: { x: raceBridge.headingX, y: 0, z: raceBridge.headingZ },
        fov: PACK_FOV,
        aspect,
      })
      applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
      if (controls.current) controls.current.target.lerp(look, k)
      return
    }

    // Fallback: aerial overview
    if (controls.current) controls.current.enabled = true
    if (userHeld.current) return
    const shot = aerialShot({ aspect })
    applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
    if (controls.current) controls.current.target.lerp(look, k)
  })

  // Seed camera once
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    const shot = aerialShot({ aspect: size.width / Math.max(1, size.height) })
    cam.position.set(shot.pos.x, shot.pos.y, shot.pos.z)
    cam.lookAt(shot.target.x, shot.target.y, shot.target.z)
    cam.fov = shot.fov
    cam.updateProjectionMatrix()
  }, [camera, size.width, size.height])

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan
      enableZoom
      enableRotate
      screenSpacePanning
      minDistance={8}
      maxDistance={Math.max(420, boot.span * 4.6)}
      minPolarAngle={0.04}
      maxPolarAngle={Math.PI / 2 - 0.06}
      enableDamping
      dampingFactor={0.08}
      onStart={() => {
        const mode = modeRef.current
        if (mode === VIEW_CHASE || (mode === VIEW_AERIAL && followRef.current)) return
        if (mode === VIEW_FULL || mode === VIEW_AERIAL || mode === VIEW_ON_TRACK) userHeld.current = true
      }}
    />
  )
}

// silence unused gl lint if any
