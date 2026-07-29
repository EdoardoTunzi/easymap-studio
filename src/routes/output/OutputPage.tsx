import { StageCanvas } from '../../engine/StageCanvas'
import { useBroadcastSubscriber } from '../../lib/sync'
import { useLoadGenerativeVisuals } from '../../lib/persistence'

export function OutputPage() {
  useBroadcastSubscriber()
  useLoadGenerativeVisuals()

  return (
    <div className="h-full w-full">
      <StageCanvas />
    </div>
  )
}
