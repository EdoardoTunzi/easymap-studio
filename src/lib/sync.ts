import { useEffect } from 'react'
import { useLayersStore, type Layer } from '../store/layersStore'

const CHANNEL_NAME = 'easyvj-sync'

/** Rimuove i blob (locali, servono solo alla persistenza) mantenendo i blob URL, validi cross-window. */
function stripBlobs(layers: Layer[]): Layer[] {
  return layers.map((l) =>
    l.media ? { ...l, media: { ...l.media, blob: undefined } } : l,
  )
}

/** Da chiamare nella finestra di Controllo: pubblica ogni cambio di stato all'Output. */
export function useBroadcastPublisher() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)

    const publish = () => {
      const { layers, activeLayerId } = useLayersStore.getState()
      channel.postMessage({
        type: 'state',
        layers: stripBlobs(layers),
        activeLayerId,
      })
    }

    // una finestra Output appena aperta chiede lo stato corrente con un "hello"
    channel.onmessage = (event) => {
      if (event.data?.type === 'hello') publish()
    }

    const unsub = useLayersStore.subscribe(publish)
    publish()

    return () => {
      unsub()
      channel.close()
    }
  }, [])
}

/** Da chiamare nella finestra di Output: applica lo stato ricevuto dal Controllo. */
export function useBroadcastSubscriber() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      if (event.data?.type !== 'state') return
      const { layers, activeLayerId } = event.data
      if (layers) useLayersStore.getState().setScene(layers, activeLayerId)
    }
    channel.postMessage({ type: 'hello' })
    return () => channel.close()
  }, [])
}
