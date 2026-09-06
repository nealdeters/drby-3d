import { RaceHUD } from '../components/race/RaceHUD'
import { RaceScene } from '../components/race/RaceScene'
import './RaceView.css'

export function RaceView() {
  return (
    <div className="race-view">
      <div className="race-view__canvas">
        <RaceScene />
      </div>
      <RaceHUD />
    </div>
  )
}
