import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { tvBridge, type TvShot } from './tvBridge'

const DIR = new THREE.Vector3()
const DOUBLE_TAP_MS = 320
const DOUBLE_TAP_PX = 22
const HOME_HOLD_S = 2.6

function followPose() {
  const px = tvBridge.followX
  const py = tvBridge.followY
  const pz = tvBridge.followZ
  const hx = tvBridge.followHX
  const hz = tvBridge.followHZ
  const len = Math.hypot(hx, hz) || 1
  const fx = hx / len
  const fz = hz / len
  const ilen = Math.hypot(px, pz) || 1
  const ox = px / ilen
  const oz = pz / ilen
  return {
    pos: new THREE.Vector3(px - fx * 7.2 + ox * 3.6, 3.8, pz - fz * 7.2 + oz * 3.6),
    look: new THREE.Vector3(px + fx * 1.6, py + 0.15, pz + fz * 1.6),
    fov: 30,
  }
}

/** Behind the pack, rail-side — load / Hold / double-tap aerial tracks with the field. */
function homePose() {
  const px = tvBridge.packX
  const py = tvBridge.packY
  const pz = tvBridge.packZ
  const hx = tvBridge.headingX
  const hz = tvBridge.headingZ
  const hlen = Math.hypot(hx, hz) || 1
  const fx = hx / hlen
  const fz = hz / hlen
  // Right of travel = inside rail on a CCW oval (same side as the rail shot).
  const rx = fz
  const rz = -fx
  return {
    pos: new THREE.Vector3(px + rx * 5.6 + fx * -8.4, 5.2, pz + rz * 5.6 + fz * -8.4),
    look: new THREE.Vector3(px + fx * 3.4, py + 0.32, pz + fz * 3.4),
    fov: 34,
  }
}

function shotPose(shot: TvShot) {
  if (shot === 'home') return homePose()

  const px = tvBridge.packX
  const py = tvBridge.packY
  const pz = tvBridge.packZ
  const hx = tvBridge.headingX
  const hz = tvBridge.headingZ
  const len = Math.hypot(hx, hz) || 1
  const fx = hx / len
  const fz = hz / len
  const rx = fz
  const rz = -fx

  switch (shot) {
    case 'spires':
      return homePose()
    case 'tower':
      return {
        pos: new THREE.Vector3(px + rx * 16 + fx * -6, 13.5, pz + rz * 16 + fz * -6),
        look: new THREE.Vector3(px, py + 0.4, pz),
        fov: 36,
      }
    case 'clubhouse':
      return {
        pos: new THREE.Vector3(px + rx * 9 + fx * -4, 4.8, pz + rz * 9 + fz * -4),
        look: new THREE.Vector3(px + fx * 3, py + 0.5, pz + fz * 3),
        fov: 34,
      }
    case 'rail':
      return {
        pos: new THREE.Vector3(px + rx * 5.2 + fx * -1.4, 2.15, pz + rz * 5.2 + fz * -1.4),
        look: new THREE.Vector3(px + fx * 2.5, py + 0.35, pz + fz * 2.5),
        fov: 32,
      }
    case 'stretch':
      return {
        pos: new THREE.Vector3(px + rx * 7.2 + fx * -5.5, 3.35, pz + rz * 7.2 + fz * -5.5),
        look: new THREE.Vector3(px + fx * 4, py + 0.45, pz + fz * 4),
        fov: 30,
      }
    case 'wire':
      return {
        pos: new THREE.Vector3(px + rx * 6 + fx * 6.5, 3.8, pz + rz * 6 + fz * 6.5),
        look: new THREE.Vector3(px, py + 0.4, pz),
        fov: 28,
      }
  }
}

function clampAboveDirt(cam: THREE.PerspectiveCamera, controls: OrbitControlsImpl) {
  if (controls.target.y < 0.4) controls.target.y = 0.4
  if (cam.position.y < 0.8) cam.position.y = 0.8
}

function seedOrbitFromCamera(cam: THREE.PerspectiveCamera, controls: OrbitControlsImpl) {
  cam.getWorldDirection(DIR)
  controls.target.copy(cam.position).addScaledVector(DIR, 14)
  clampAboveDirt(cam, controls)
}

const BOOT = homePose()

/** Orbit any time; broadcast cuts only while the user is not looking around. Double-tap homes to the behind-the-field aerial. */
export function BroadcastCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const pos = useRef(BOOT.pos.clone())
  const look = useRef(BOOT.look.clone())
  const fov = useRef(BOOT.fov)
  const aimed = useRef(false)
  const userLook = useRef(false)
  const homeUntil = useRef(performance.now() / 1000 + HOME_HOLD_S)
  const gl = useThree((s) => s.gl)

  const applyHome = () => {
    const pose = homePose()
    pos.current.copy(pose.pos)
    look.current.copy(pose.look)
    fov.current = pose.fov
    if (cam.current) {
      cam.current.position.copy(pose.pos)
      cam.current.lookAt(pose.look)
      cam.current.fov = pose.fov
      cam.current.updateProjectionMatrix()
    }
    if (controls.current) {
      controls.current.target.copy(pose.look)
      controls.current.enabled = false
      controls.current.update()
    }
  }

  useEffect(() => {
    const el = gl.domElement
    let lastT = 0
    let lastX = 0
    let lastY = 0
    const onPointerDown = (e: PointerEvent) => {
      const now = performance.now()
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (now - lastT < DOUBLE_TAP_MS && dx * dx + dy * dy < DOUBLE_TAP_PX * DOUBLE_TAP_PX) {
        e.preventDefault()
        e.stopImmediatePropagation()
        lastT = 0
        userLook.current = false
        tvBridge.userLook = false
        tvBridge.followId = null
        homeUntil.current = Number.POSITIVE_INFINITY
        applyHome()
        return
      }
      lastT = now
      lastX = e.clientX
      lastY = e.clientY
      userLook.current = true
      tvBridge.userLook = true
      tvBridge.followId = null
      homeUntil.current = 0
      if (cam.current && controls.current) {
        controls.current.enabled = true
        seedOrbitFromCamera(cam.current, controls.current)
        controls.current.update()
      }
    }
    el.addEventListener('pointerdown', onPointerDown, true)
    return () => el.removeEventListener('pointerdown', onPointerDown, true)
  }, [gl])

  useFrame((_, dt) => {
    if (!cam.current) return

    if (!aimed.current) {
      applyHome()
      aimed.current = true
    }

    if (tvBridge.followId) {
      userLook.current = false
      tvBridge.userLook = false
    }

    if (controls.current) {
      controls.current.enabled = userLook.current
      clampAboveDirt(cam.current, controls.current)
    }

    if (userLook.current) {
      pos.current.copy(cam.current.position)
      cam.current.getWorldDirection(DIR)
      look.current.copy(cam.current.position).addScaledVector(DIR, 14)
      return
    }

    const nowS = performance.now() / 1000
    const tracking = Boolean(tvBridge.followId && tvBridge.followOk)
    const pose = tracking
      ? followPose()
      : nowS < homeUntil.current || !tvBridge.racing
        ? homePose()
        : shotPose(tvBridge.shot)
    const k = 1 - Math.pow(0.08, dt)
    pos.current.lerp(pose.pos, k)
    look.current.lerp(pose.look, k)
    fov.current = THREE.MathUtils.lerp(fov.current, pose.fov, k)
    cam.current.position.copy(pos.current)
    cam.current.lookAt(look.current)
    if (Math.abs(cam.current.fov - fov.current) > 0.05) {
      cam.current.fov = fov.current
      cam.current.updateProjectionMatrix()
    }
    if (controls.current) controls.current.target.copy(look.current)
  })

  return (
    <>
      <PerspectiveCamera
        ref={cam}
        makeDefault
        fov={BOOT.fov}
        near={0.15}
        far={240}
        position={[BOOT.pos.x, BOOT.pos.y, BOOT.pos.z]}
      />
      <OrbitControls
        ref={controls}
        enabled={false}
        enableDamping
        dampingFactor={0.12}
        enablePan
        minDistance={5}
        maxDistance={86}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.06}
        onChange={() => {
          if (cam.current && controls.current) clampAboveDirt(cam.current, controls.current)
        }}
      />
    </>
  )
}
