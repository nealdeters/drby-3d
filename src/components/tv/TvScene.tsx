import { memo, type MutableRefObject } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, Sky } from '@react-three/drei'
import type { Horse } from '../../data/fakeSeason'
import type { TrackSurface } from '../race/Track'
import { BroadcastCamera } from './BroadcastCamera'
import { TvField } from './TvField'
import { TvTrack } from './TvTrack'

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
      <color attach="background" args={['#9ec4e6']} />
      <fog attach="fog" args={['#c5d8ea', 110, 240]} />
      <BroadcastCamera />
      <Sky
        distance={450000}
        sunPosition={[70, 28, 50]}
        inclination={0.47}
        azimuth={0.18}
        mieCoefficient={0.005}
        mieDirectionalG={0.82}
        rayleigh={0.55}
        turbidity={3.5}
      />
      <ambientLight intensity={0.5} color="#fff1dc" />
      <hemisphereLight args={['#b7d2ef', '#6e8a48', 0.42]} />
      <directionalLight
        castShadow
        position={[24, 36, 22]}
        intensity={1.65}
        color="#ffe4b0"
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={120}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
        shadow-bias={-0.00025}
      />
      <directionalLight position={[-18, 14, -8]} intensity={0.28} color="#9ab6d8" />
      <TvTrack key={surface} surface={surface} />
      <TvField
        horses={horses}
        liveFeed={liveFeed}
        isRacing={isRacing}
        trackLaps={trackLaps}
        progressRef={progressRef}
        laneRef={laneRef}
        raceId={raceId}
      />
      <Environment preset="sunset" environmentIntensity={0.28} />
    </Canvas>
  )
})
