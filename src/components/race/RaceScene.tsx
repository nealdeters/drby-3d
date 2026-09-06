import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, PerspectiveCamera, Sky } from '@react-three/drei'
import * as THREE from 'three'
import { HORSES } from '../../data/fakeSeason'
import { HorseMesh } from './Horse'
import { Track } from './Track'
import { createFieldState, stepField, type HorseSimState } from './trackMath'

/**
 * High grandstand / slight top-¾ overhead.
 * Oval outer extents ~±24 X and ~±15 Z; stands/spires push the frame to
 * roughly X±32 and Z −24…+30. Camera must sit far/high enough that both
 * straights and both turns stay in a 1280×800 (and 1920×1080) viewport.
 */
function GrandstandCamera() {
  const cam = useRef<THREE.PerspectiveCamera>(null)
  useFrame(({ clock }) => {
    if (!cam.current) return
    const t = clock.getElapsedTime()
    cam.current.position.x = Math.sin(t * 0.08) * 0.8
    cam.current.position.y = 52 + Math.sin(t * 0.12) * 0.2
    cam.current.position.z = 48 + Math.cos(t * 0.07) * 0.35
    cam.current.lookAt(0, 0.15, -0.5)
  })
  return (
    <PerspectiveCamera
      ref={cam}
      makeDefault
      fov={50}
      near={0.1}
      far={500}
      position={[0, 52, 48]}
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
      {/* Soft daylight haze — starts past the far rail so the oval stays clear */}
      <fog attach="fog" args={['#c8dcf0', 140, 320]} />
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
        shadow-camera-far={140}
        shadow-camera-left={-55}
        shadow-camera-right={55}
        shadow-camera-top={55}
        shadow-camera-bottom={-55}
        shadow-bias={-0.0002}
      />
      <directionalLight position={[-20, 18, -12]} intensity={0.35} color="#a8c8f0" />
      <Track />
      <RacingField />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
}
