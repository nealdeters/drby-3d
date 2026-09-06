import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, Sky } from '@react-three/drei'
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
    // High grandstand / slight top-down: full oval + margin in frame
    cam.current.position.x = Math.sin(t * 0.1) * 0.55
    cam.current.position.y = 34 + Math.sin(t * 0.15) * 0.15
    cam.current.position.z = 42 + Math.cos(t * 0.08) * 0.3
    cam.current.lookAt(0, 0.2, -1.2)
  })
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={42}
      near={0.1}
      far={400}
      position={[0, 34, 42]}
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
      <color attach="background" args={['#87b8e8']} />
      {/* Soft daylight haze only — no dark mud void */}
      <fog attach="fog" args={['#c5daf0', 95, 220]} />
      <GrandstandCamera />
      <Sky
        distance={450000}
        sunPosition={[80, 35, 40]}
        inclination={0.48}
        azimuth={0.22}
        mieCoefficient={0.004}
        mieDirectionalG={0.8}
        rayleigh={0.65}
        turbidity={4}
      />
      <ambientLight intensity={0.55} color="#fff4e0" />
      <hemisphereLight args={['#b8d4f5', '#7a9a4a', 0.45]} />
      <directionalLight
        castShadow
        position={[28, 42, 18]}
        intensity={1.55}
        color="#ffe8b8"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={120}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-20, 18, -12]} intensity={0.35} color="#a8c8f0" />
      <Track />
      <RacingField />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
}
