import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import * as THREE from 'three'
import { tvBridge, type TvShot } from './tvBridge'

const SPIRES_POS = new THREE.Vector3(-2.5, 5.2, 6.5)
const SPIRES_LOOK = new THREE.Vector3(0, 7.5, 22)

function shotPose(shot: TvShot) {
  const px = tvBridge.packX
  const py = tvBridge.packY
  const pz = tvBridge.packZ
  const hx = tvBridge.headingX
  const hz = tvBridge.headingZ
  const len = Math.hypot(hx, hz) || 1
  const fx = hx / len
  const fz = hz / len
  // Right vector on XZ
  const rx = fz
  const rz = -fx

  switch (shot) {
    case 'spires':
      // Infield, Twin Spires in frame, stretch horses mid-ground
      return {
        pos: SPIRES_POS.clone(),
        look: SPIRES_LOOK.clone(),
        fov: 42,
      }
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

/** Broadcast cuts while the card is live; orbit the oval between races. */
export function BroadcastCamera({ explore = false }: { explore?: boolean }) {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  const controls = useRef<OrbitControlsImpl>(null)
  const pos = useRef(SPIRES_POS.clone())
  const look = useRef(SPIRES_LOOK.clone())
  const fov = useRef(42)
  const wasExplore = useRef(explore)
  const aimed = useRef(false)
  const dir = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    if (!cam.current) return

    if (!aimed.current) {
      cam.current.position.copy(pos.current)
      cam.current.lookAt(look.current)
      aimed.current = true
      if (explore && controls.current) {
        controls.current.target.copy(look.current)
        controls.current.update()
      }
    }

    if (explore) {
      if (!wasExplore.current && controls.current) {
        cam.current.getWorldDirection(dir.current)
        controls.current.target.copy(cam.current.position).addScaledVector(dir.current, 14)
        controls.current.update()
      }
      wasExplore.current = true
      return
    }

    if (wasExplore.current) {
      pos.current.copy(cam.current.position)
      cam.current.getWorldDirection(dir.current)
      look.current.copy(cam.current.position).addScaledVector(dir.current, 14)
      wasExplore.current = false
    }

    const pose = shotPose(tvBridge.shot)
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
  })

  return (
    <>
      <PerspectiveCamera
        ref={cam}
        makeDefault
        fov={42}
        near={0.15}
        far={240}
        position={[-2.5, 5.2, 6.5]}
      />
      <OrbitControls
        ref={controls}
        enabled={explore}
        enableDamping
        dampingFactor={0.12}
        enablePan
        minDistance={5}
        maxDistance={86}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI / 2 - 0.06}
        target={[0, 1.2, 0]}
      />
    </>
  )
}
