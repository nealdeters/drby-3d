import { useEffect, useState } from 'react'
import { tvBridge } from './tvBridge'

type Props = {
  isRacing: boolean
  live: boolean
  trackName?: string
  official?: boolean
}

export function TvLowerThirds({ isRacing, live, trackName, official = false }: Props) {
  const [shot, setShot] = useState(tvBridge.shot)
  const [userLook, setUserLook] = useState(tvBridge.userLook)
  const [followId, setFollowId] = useState(tvBridge.followId)
  const [leaderLap, setLeaderLap] = useState(tvBridge.leaderLap)
  const [trackLaps, setTrackLaps] = useState(tvBridge.trackLaps)

  useEffect(() => {
    const id = window.setInterval(() => {
      setShot(tvBridge.shot)
      setUserLook(tvBridge.userLook)
      setFollowId(tvBridge.followId)
      setLeaderLap(tvBridge.leaderLap)
      setTrackLaps(tvBridge.trackLaps)
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  const raw = followId ? 'follow' : userLook ? 'look' : official ? 'wire' : !isRacing ? 'clubhouse' : shot
  const chip = raw === 'home' || raw === 'spires' ? 'clubhouse' : raw

  return (
    <div className="tv-thirds">
      <div className="tv-thirds__bug">
        <span className="tv-thirds__net">DRBY TV</span>
        <span className="tv-thirds__meet">{trackName ?? 'Churchill dirt'}</span>
        <span className="tv-thirds__lap">
          Lap {Math.max(1, leaderLap)} / {trackLaps > 0 ? trackLaps : 1}
        </span>
      </div>
      <div
        className={
          live && isRacing
            ? 'tv-thirds__live'
            : live && official
              ? 'tv-thirds__live is-official'
              : 'tv-thirds__live is-demo'
        }
      >
        {live && isRacing ? 'Live' : live && official ? 'Official' : live ? 'Hold' : 'Demo'}
      </div>
      <div className="tv-thirds__shot">{chip}</div>
      <div className="tv-thirds__look">
        {followId
          ? 'Following · tap again to drop · double-tap clubhouse'
          : userLook
            ? 'Double-tap for the clubhouse'
            : 'Tap a racer to follow · drag to look around · double-tap clubhouse'}
      </div>
    </div>
  )
}
