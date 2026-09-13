import { memo, type MutableRefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import type { Horse } from '../../data/fakeSeason'
import { Track, type TrackSurface } from '../race/Track'
import { BroadcastCamera } from './BroadcastCamera'
import { TvField } from './TvField'

export type TvSceneProps = {
  horses: Horse[]
  liveFeed?: boolean
  isRacing?: boolean
  trackLaps?: number
  surface?: TrackSurface
  progressRef?: MutableRefObject<Record<string, number>>
  laneRef?: MutableRefObject<Record<string, number>>
  raceId?: string | null
}

export const TvScene = memo(function TvScene({
  horses,
  liveFeed = false,
  isRacing = false,
  trackLaps = 1,
  surface = 'dirt',
  progressRef,
  laneRef,
  raceId = null,
}: TvSceneProps) {
  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={['#87b8e8']} />
      <fog attach="fog" args={['#c8dcf0', 140, 320]} />
      <BroadcastCamera />
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
      <Track key={surface} surface={surface} />
      <TvField
        horses={horses}
        liveFeed={liveFeed}
        isRacing={isRacing}
        trackLaps={trackLaps}
        progressRef={progressRef}
        laneRef={laneRef}
        raceId={raceId}
      />
      <Environment preset="sunset" environmentIntensity={0.35} />
    </Canvas>
  )
})
