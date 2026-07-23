import { StageCanvas } from '../../engine/StageCanvas'
import { useBroadcastSubscriber } from '../../lib/sync'

export function OutputPage() {
  useBroadcastSubscriber()

  return (
    <div className="h-full w-full">
      <StageCanvas />
    </div>
  )
}
