import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useEffectsStore } from '../store/effectsStore'

const CHANNEL_NAME = 'easyvj-sync'

/** Da chiamare nella finestra di Controllo: pubblica ogni cambio di stato all'Output. */
export function useBroadcastPublisher() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)

    const publish = () => {
      const project = useProjectStore.getState()
      const effects = useEffectsStore.getState()
      // il blob resta locale (serve solo alla persistenza); il blob URL è valido cross-window
      const media = project.media ? { ...project.media, blob: undefined } : null
      channel.postMessage({
        type: 'state',
        project: {
          media,
          corners: project.corners,
          transform: project.transform,
          lumaKey: project.lumaKey,
        },
        effects: {
          activeShaderName: effects.activeShaderName,
          size: effects.size,
          params: effects.params,
        },
      })
    }

    // una finestra Output appena aperta chiede lo stato corrente con un "hello"
    channel.onmessage = (event) => {
      if (event.data?.type === 'hello') publish()
    }

    const unsubProject = useProjectStore.subscribe(publish)
    const unsubEffects = useEffectsStore.subscribe(publish)
    publish()

    return () => {
      unsubProject()
      unsubEffects()
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
      const { project, effects } = event.data
      if (project) useProjectStore.setState(project)
      if (effects) useEffectsStore.setState(effects)
    }
    channel.postMessage({ type: 'hello' })
    return () => channel.close()
  }, [])
}
