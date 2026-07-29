import { useEffect } from 'react'
import { useLayersStore, type Layer } from '../store/layersStore'
import { useOutputStore } from '../store/outputStore'
import { useEffectsStore } from '../store/effectsStore'
import { parseShader } from '../engine/isfParser'

const CHANNEL_NAME = 'easyvj-sync'

interface Payload {
  type: 'state'
  layers: Layer[]
  activeLayerId: string
}

// Canale riusato: in modalità live il Generative Lab pubblica a ogni movimento di slider,
// aprirne e chiuderne uno per messaggio sarebbe inutilmente costoso.
let shaderChannel: BroadcastChannel | null = null

/**
 * Comunica un visual generativo (in editing, appena salvato o rinominato) alle finestre Output
 * già aperte: senza questo, l'Output conoscerebbe solo gli shader letti da IndexedDB al proprio
 * avvio e un layer che usa un visual non ancora salvato non verrebbe disegnato.
 * Fire-and-forget, fuori dal payload di stato.
 */
export function publishGenerativeShader(source: string) {
  shaderChannel ??= new BroadcastChannel(CHANNEL_NAME)
  shaderChannel.postMessage({ type: 'shader', source })
}

/** Rimuove i blob (locali, servono solo alla persistenza) mantenendo i blob URL, validi cross-window. */
function stripBlobs(layers: Layer[]): Layer[] {
  return layers.map((l) => ({
    ...l,
    media: l.media ? { ...l.media, blob: undefined } : null,
    maskImage: l.maskImage ? { ...l.maskImage, blob: undefined } : null,
  }))
}

/**
 * Da chiamare nella finestra di Controllo: pubblica lo stato all'Output.
 * In modalità Live gli aggiornamenti automatici sono sospesi: l'Output resta all'ultimo stato
 * inviato (memorizzato in lastPayload) finché non si preme "Esegui in output" o si esce da Live.
 */
export function useBroadcastPublisher() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)

    const buildPayload = (): Payload => {
      const { layers, activeLayerId } = useLayersStore.getState()
      return { type: 'state', layers: stripBlobs(layers), activeLayerId }
    }

    // ultimo stato effettivamente inviato: risponde agli "hello" delle finestre Output appena aperte
    let lastPayload = buildPayload()

    const publishNow = () => {
      lastPayload = buildPayload()
      channel.postMessage(lastPayload)
      useOutputStore.getState().clearDirty()
    }

    // ad ogni modifica dei layer: se Live, marca "in sospeso"; altrimenti invia subito
    const onLayersChange = () => {
      if (useOutputStore.getState().live) useOutputStore.getState().markDirty()
      else publishNow()
    }
    const unsubLayers = useLayersStore.subscribe(onLayersChange)

    // reagisce ai comandi Live (push manuale e uscita dalla modalità Live)
    let lastPush = useOutputStore.getState().pushId
    let lastLive = useOutputStore.getState().live
    const unsubOutput = useOutputStore.subscribe((s) => {
      if (s.pushId !== lastPush) {
        lastPush = s.pushId
        publishNow()
      }
      if (s.live !== lastLive) {
        const wasLive = lastLive
        lastLive = s.live
        if (wasLive && !s.live) publishNow() // uscendo da Live: allinea subito l'Output
      }
    })

    // una finestra Output appena aperta riceve l'ultimo stato inviato (in Live, quello committato)
    channel.onmessage = (event) => {
      if (event.data?.type === 'hello') channel.postMessage(lastPayload)
    }

    publishNow()

    return () => {
      unsubLayers()
      unsubOutput()
      channel.close()
    }
  }, [])
}

/** Da chiamare nella finestra di Output: applica lo stato ricevuto dal Controllo. */
export function useBroadcastSubscriber() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event) => {
      if (event.data?.type === 'shader') {
        useEffectsStore.getState().registerShaders([parseShader(event.data.source)])
        return
      }
      if (event.data?.type !== 'state') return
      const { layers, activeLayerId } = event.data
      if (layers) useLayersStore.getState().setScene(layers, activeLayerId)
    }
    channel.postMessage({ type: 'hello' })
    return () => channel.close()
  }, [])
}
