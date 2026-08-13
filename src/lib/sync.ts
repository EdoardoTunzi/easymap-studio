import { useEffect } from 'react'
import { useLayersStore, type Layer } from '../store/layersStore'
import { useOutputStore } from '../store/outputStore'
import { usePlaylistStore } from '../store/playlistStore'

const CHANNEL_NAME = 'easyvj-sync'

interface Payload {
  type: 'state'
  layers: Layer[]
  activeLayerId: string
  /** Griglia di calibrazione: deve comparire sul proiettore, non solo nell'anteprima. */
  testPattern: boolean
  /**
   * Durata in secondi della dissolvenza con cui l'Output deve accogliere questa scena.
   * 0 = cambio immediato. Valorizzata solo sugli invii espliciti (pulsante "Esegui in output"
   * e uscita dalla modalità Live): gli aggiornamenti continui fuori da Live devono restare
   * istantanei, altrimenti ogni movimento di slider arriverebbe smorzato e in ritardo.
   */
  fadeDuration: number
}

/** Durata della dissolvenza scelta nella barra playlist (0 se la transizione è impostata su "secca"). */
function pushFadeDuration(): number {
  const { transitionMode, transitionDuration } = usePlaylistStore.getState()
  return transitionMode === 'smooth' ? transitionDuration : 0
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

    const buildPayload = (fadeDuration = 0): Payload => {
      const { layers, activeLayerId, testPattern } = useLayersStore.getState()
      return { type: 'state', layers: stripBlobs(layers), activeLayerId, testPattern, fadeDuration }
    }

    // ultimo stato effettivamente inviato: risponde agli "hello" delle finestre Output appena aperte
    let lastPayload = buildPayload()

    const publishNow = (fadeDuration = 0) => {
      const payload = buildPayload(fadeDuration)
      channel.postMessage(payload)
      // memorizzato senza dissolvenza: una finestra Output aperta più tardi deve trovarsi
      // subito la scena, non riprodurre la transizione di un invio già avvenuto
      lastPayload = { ...payload, fadeDuration: 0 }
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
        publishNow(pushFadeDuration())
      }
      if (s.live !== lastLive) {
        const wasLive = lastLive
        lastLive = s.live
        // uscendo da Live: allinea l'Output, con la stessa dissolvenza del push manuale
        if (wasLive && !s.live) publishNow(pushFadeDuration())
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
    let fadeRaf: number | null = null

    /** Anima il crossfade della scena; un nuovo invio durante la dissolvenza la fa ripartire. */
    const runFade = (durationSec: number) => {
      if (fadeRaf != null) cancelAnimationFrame(fadeRaf)
      const start = performance.now()
      const durationMs = durationSec * 1000
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs)
        useLayersStore.getState().setSceneFade(progress)
        fadeRaf = progress < 1 ? requestAnimationFrame(step) : null
      }
      fadeRaf = requestAnimationFrame(step)
    }

    channel.onmessage = (event) => {
      if (event.data?.type !== 'state') return
      const { layers, activeLayerId, testPattern, fadeDuration } = event.data
      if (layers) {
        if (fadeDuration > 0) {
          useLayersStore.getState().beginSceneCrossfade(layers, activeLayerId)
          runFade(fadeDuration)
        } else {
          // setScene chiude anche un eventuale crossfade in corso
          if (fadeRaf != null) cancelAnimationFrame(fadeRaf)
          fadeRaf = null
          useLayersStore.getState().setScene(layers, activeLayerId)
        }
      }
      useLayersStore.getState().setTestPattern(Boolean(testPattern))
    }
    channel.postMessage({ type: 'hello' })
    return () => {
      if (fadeRaf != null) cancelAnimationFrame(fadeRaf)
      channel.close()
    }
  }, [])
}
