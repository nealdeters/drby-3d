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

  useEffect(() => {
    const id = window.setInterval(() => {
      setShot(tvBridge.shot)
      setUserLook(tvBridge.userLook)
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  const chip = userLook ? 'look' : !isRacing ? 'home' : shot

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
        {userLook ? 'Double-tap for the aerial' : 'Drag to look around · pinch to zoom · double-tap aerial'}
      </div>
    </div>
  )
}
