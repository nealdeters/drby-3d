import { useEffect, useState } from 'react'
import { tvBridge } from './tvBridge'

type Props = {
  isRacing: boolean
  live: boolean
  trackName?: string
}

export function TvLowerThirds({ isRacing, live, trackName }: Props) {
  const [shot, setShot] = useState(tvBridge.shot)

  useEffect(() => {
    const id = window.setInterval(() => {
      setShot(tvBridge.shot)
    }, 180)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="tv-thirds">
      <div className="tv-thirds__bug">
        <span className="tv-thirds__net">DRBY TV</span>
        <span className="tv-thirds__meet">{trackName ?? 'Churchill dirt'}</span>
      </div>
      <div className={live && isRacing ? 'tv-thirds__live' : 'tv-thirds__live is-demo'}>
        {live && isRacing ? 'Live' : live ? 'Hold' : 'Demo'}
      </div>
      <div className="tv-thirds__shot">{shot}</div>
    </div>
  )
}
