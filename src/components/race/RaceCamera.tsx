import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { raceBridge } from './raceBridge'
import { shotKind } from './cameraDirector'
import {
  DEFAULT_VIEW,
  FOLLOW_AERIAL_K,
  PACK_FOV,
  aerialShot,
  VIEW_ON_TRACK,
  chaseShot,
  dampPoint,
  followAerialShot,
  packShot,
  type Vec3,
  type ViewMode,
} from './cameraViews'

type Props = {
  viewMode: ViewMode
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

export function RaceCamera({ viewMode, homeNonce }: Props) {
  const { camera, size } = useThree()
  const controls = useRef<OrbitControlsImpl>(null)
  const modeRef = useRef(viewMode || DEFAULT_VIEW)
  modeRef.current = viewMode || DEFAULT_VIEW
  const look = useMemo(() => new THREE.Vector3(), [])
  const desired = useMemo(() => new THREE.Vector3(), [])
  const desiredLook = useMemo(() => new THREE.Vector3(), [])
  const userHeld = useRef(false)
  const snap = useRef(true)
  const followSmooth = useRef<Vec3 | null>(null)
  const lastKind = useRef('')
  const boot = useMemo(() => aerialShot({ aspect: 16 / 9 }), [])

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    cam.near = 0.5
    cam.far = Math.max(420, boot.span * 5)
    const mode = modeRef.current
    cam.fov = mode === VIEW_ON_TRACK ? PACK_FOV : 50
    cam.updateProjectionMatrix()
  }, [camera, boot.span, viewMode])

  useEffect(() => {
    userHeld.current = false
    snap.current = true
    followSmooth.current = null
    lastKind.current = ''
  }, [homeNonce, viewMode])

  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera
    const mode = modeRef.current
    const aspect = size.width / Math.max(1, size.height)
    const kind = shotKind({ viewMode: mode })
    const tracking = Boolean(raceBridge.followOk)
    const doSnap = snap.current || lastKind.current !== kind
    lastKind.current = kind
    const k = doSnap ? 1 : 0.14
    snap.current = false

    if (kind === 'aerial') {
      if (!tracking) {
        if (controls.current) controls.current.enabled = true
        if (userHeld.current) return
        const shot = aerialShot({ aspect })
        applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
        if (controls.current) controls.current.target.lerp(look, k)
        return
      }
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const next = { x: raceBridge.followX, y: raceBridge.followY, z: raceBridge.followZ }
      followSmooth.current = doSnap ? next : dampPoint(followSmooth.current, next, FOLLOW_AERIAL_K)
      const shot = followAerialShot(followSmooth.current)
      const airK = doSnap ? 1 : FOLLOW_AERIAL_K
      applyShot(cam, shot, desired, desiredLook, look, airK, shot.span)
      if (controls.current) controls.current.target.lerp(look, airK)
      return
    }

    if (kind === 'chase') {
      if (!tracking) {
        if (controls.current) controls.current.enabled = true
        if (userHeld.current) return
        const shot = aerialShot({ aspect })
        applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
        return
      }
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const shot = chaseShot(
        { x: raceBridge.followX, y: raceBridge.followY, z: raceBridge.followZ },
        { x: raceBridge.followHX, y: 0, z: raceBridge.followHZ },
      )
      applyShot(cam, shot, desired, desiredLook, look, doSnap ? 1 : 0.12, shot.span)
      if (controls.current) controls.current.target.lerp(look, doSnap ? 1 : 0.12)
      return
    }

    if (kind === 'on-track') {
      if (controls.current) controls.current.enabled = true
      if (userHeld.current) return
      const pts = raceBridge.packPoints
      if (!pts.length) {
        const shot = aerialShot({ aspect })
        applyShot(cam, shot, desired, desiredLook, look, k, shot.span)
        return
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
  })

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
        userHeld.current = true
      }}
    />
  )
}
