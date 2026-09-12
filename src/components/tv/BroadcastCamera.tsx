import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { tvBridge, type TvShot } from './tvBridge'

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
        pos: new THREE.Vector3(-2.5, 5.2, 6.5),
        look: new THREE.Vector3(0, 7.5, 22),
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

export function BroadcastCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  const pos = useRef(new THREE.Vector3(0, 5.2, 8))
  const look = useRef(new THREE.Vector3(0, 6, 20))
  const fov = useRef(40)

  useFrame((_, dt) => {
    if (!cam.current) return
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
    <PerspectiveCamera ref={cam} makeDefault fov={40} near={0.15} far={240} position={[0, 5.2, 8]} />
  )
}
