import { StageCanvas } from '../../engine/StageCanvas'
import { useBroadcastSubscriber } from '../../lib/sync'
import { useAudioAutoStart } from '../../hooks/use-audio-autostart'

export function OutputPage() {
  useBroadcastSubscriber()
  // gli effetti audio-reattivi hanno bisogno dell'ingresso anche qui: la finestra se lo apre
  // da sola quando la scena ne contiene uno (uno stream non passa dal BroadcastChannel)
  useAudioAutoStart()

  return (
    <div className="h-full w-full">
      <StageCanvas />
    </div>
  )
}
