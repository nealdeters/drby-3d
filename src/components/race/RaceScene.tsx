import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { HORSES } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Track } from './Track'
import { createFieldState, stepField, type HorseSimState } from './trackMath'

function GrandstandCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock }) => {
    if (!cam.current) return
    const t = clock.getElapsedTime()
    // Elevated middle-grandstand: whole oval stays in frame, subtle sway
    cam.current.position.x = Math.sin(t * 0.12) * 0.45
    cam.current.position.y = 14.5 + Math.sin(t * 0.18) * 0.12
    cam.current.position.z = 26.5 + Math.cos(t * 0.1) * 0.25
    cam.current.lookAt(0, 0.15, -1.5)
  })
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={50}
      near={0.1}
      far={250}
      position={[0, 14.5, 26.5]}
    />
  )
}

function RacingField() {
  const fieldRef = useRef<HorseSimState[]>(
    createFieldState(
      HORSES.length,
      HORSES.map((h) => h.speedBias),
    ),
  )

  // Stable identity for children
  const horses = useMemo(() => HORSES, [])

  useFrame((_, dt) => {
    const clamped = Math.min(dt, 0.05)
    stepField(fieldRef.current, clamped, 1 / 30)
  })

  return (
    <>
      {horses.map((horse, i) => (
        <HorseMesh key={horse.id} horse={horse} index={i} fieldRef={fieldRef} />
      ))}
    </>
  )
}

export function RaceScene() {
  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#0c0907']} />
      {/* Soft fog — far rail stays visible */}
      <fog attach="fog" args={['#0c0907', 55, 120]} />
      <GrandstandCamera />
      <ambientLight intensity={0.4} color="#ffe8c8" />
      <directionalLight
        castShadow
        position={[10, 22, 8]}
        intensity={1.15}
        color="#fff0d8"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={80}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
      />
      <Track />
      <RacingField />
      <Environment preset="night" />
    </Canvas>
  )
}
