import { useEffect, useState } from 'react'
import { tvBridge } from './tvBridge'

type Props = {
  isRacing: boolean
  live: boolean
  trackName?: string
}

export function TvLowerThirds({ isRacing, live, trackName }: Props) {
  const [shot, setShot] = useState(tvBridge.shot)
  const [userLook, setUserLook] = useState(tvBridge.userLook)
  const [followId, setFollowId] = useState(tvBridge.followId)

  useEffect(() => {
    const id = window.setInterval(() => {
      setShot(tvBridge.shot)
      setUserLook(tvBridge.userLook)
      setFollowId(tvBridge.followId)
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  const chip = followId ? 'follow' : userLook ? 'look' : !isRacing ? 'home' : shot

  return (
    <div className="tv-thirds">
      <div className="tv-thirds__bug">
        <span className="tv-thirds__net">DRBY TV</span>
        <span className="tv-thirds__meet">{trackName ?? 'Churchill dirt'}</span>
      </div>
      <div className={live && isRacing ? 'tv-thirds__live' : 'tv-thirds__live is-demo'}>
        {live && isRacing ? 'Live' : live ? 'Hold' : 'Demo'}
      </div>
      <div className="tv-thirds__shot">{chip}</div>
      <div className="tv-thirds__look">
        {followId
          ? 'Following · tap again to drop · double-tap aerial'
          : userLook
            ? 'Double-tap for the aerial'
            : 'Tap a racer to follow · drag to look around · double-tap aerial'}
      </div>
    </div>
  )
}
