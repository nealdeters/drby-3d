import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera } from '@react-three/drei'
import * as THREE from 'three'
import { HORSES } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Track } from './Track'

function GrandstandCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock }) => {
    if (!cam.current) return
    const t = clock.getElapsedTime()
    // Subtle idle sway from middle grandstand
    cam.current.position.x = Math.sin(t * 0.15) * 0.35
    cam.current.position.y = 5.2 + Math.sin(t * 0.22) * 0.08
    cam.current.lookAt(0, 0.2, -1)
  })
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={42}
      near={0.1}
      far={200}
      position={[0, 5.2, 15.5]}
    />
  )
}

function RacingField() {
  const start = useRef(performance.now())
  // Full lap ~28s base; horses multiply via speedBias
  const getProgress = useMemo(
    () => () => {
      const elapsed = (performance.now() - start.current) / 1000
      return (elapsed / 28) % 1
    },
    [],
  )

  return (
    <>
      {HORSES.map((horse, i) => (
        <HorseMesh
          key={horse.id}
          horse={horse}
          lane={i}
          lanes={HORSES.length}
          getProgress={getProgress}
        />
      ))}
    </>
  )
}

export function RaceScene() {
  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#0c0907']} />
      <fog attach="fog" args={['#0c0907', 28, 70]} />
      <GrandstandCamera />
      <ambientLight intensity={0.35} color="#ffe8c8" />
      <directionalLight
        castShadow
        position={[8, 18, 6]}
        intensity={1.1}
        color="#fff0d8"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <Track />
      <RacingField />
      <Environment preset="night" />
    </Canvas>
  )
}
