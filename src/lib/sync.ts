import { useEffect } from 'react'
import { useLayersStore, type Layer } from '../store/layersStore'
import { useOutputStore } from '../store/outputStore'
import { usePlaylistStore } from '../store/playlistStore'
import { renderSettingsOf, useRenderStore, type RenderSettings } from '../store/renderStore'
import type { RGB } from '../store/paletteStore'
import type { MediaAsset } from '../store/projectStore'

const CHANNEL_NAME = 'easyvj-sync'

/** Aggiornamento leggero della sola palette di uno o più layer (vedi applyPaletteTick). */
interface PalettePayload {
  type: 'palette'
  entries: [string, RGB[]][]
}

/** Cambio di clip della playlist di asset di un layer (vedi applyAssetTick). */
interface MediaPayload {
  type: 'media'
  layerId: string
  media: MediaAsset
}

/**
 * Impostazioni di resa (supersampling, dither, grana…). Messaggio separato dallo stato perché
 * viaggia **sempre**, modalità Live compresa: non è la scena, è il modo di disegnarla. Se passasse
 * dal payload dello stato, alzare la qualità durante un set non avrebbe effetto sul proiettore
 * fino al successivo "Esegui in output".
 */
interface RenderPayload {
  type: 'render'
  settings: RenderSettings
}

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
 * Canale del Controllo, condiviso con applyPaletteTick. null nella finestra Output (dove il
 * publisher non è montato) e finché il Control non ha montato il publisher.
 */
let controlChannel: BroadcastChannel | null = null

/**
 * true mentre il loop delle palette scrive nello store: quel cambiamento viaggia sul canale
 * dedicato 'palette', quindi il publisher non deve né ripubblicare l'intera scena né marcarla
 * "in sospeso" in Live (il loop scrive ~30 volte al secondo).
 */
let paletteTickInFlight = false

/** Come `paletteTickInFlight`, per i cambi di clip della playlist di asset. */
let mediaTickInFlight = false

/**
 * Ultima clip mandata in onda da una playlist di asset, per layer. Serve solo a rispondere agli
 * "hello": una finestra Output aperta a metà rotazione deve trovare la clip corrente, non quella
 * che c'era all'ultimo invio di scena.
 */
const lastAssetMedia = new Map<string, MediaAsset>()

/**
 * Scrive una palette generata dal loop e la propaga all'Output come aggiornamento isolato.
 *
 * Serve perché in modalità Live l'Output è congelato sull'ultima scena inviata: le scritture del
 * loop restavano nel Control e il proiettore mostrava un colore fisso. Un tick di palette però
 * non è una "modifica in preparazione" — è l'animazione della scena già in onda — quindi viaggia
 * sempre, Live compreso, senza far scattare il badge delle modifiche non inviate.
 *
 * Fuori da Live sostituisce l'invio dello stato completo: l'Output riceve solo i colori invece
 * dell'intero elenco di layer trenta volte al secondo.
 *
 * L'Output applica il tick solo ai layer che possiede davvero: se la scena in onda è un'altra
 * (Live con modifiche non ancora inviate), i colori di un layer che lì non esiste sono ignorati.
 */
export function applyPaletteTick(layerId: string, colors: RGB[]) {
  const before = useLayersStore.getState().layers
  paletteTickInFlight = true
  try {
    useLayersStore.getState().setLayerPaletteColors(layerId, colors)
  } finally {
    paletteTickInFlight = false
  }
  if (!controlChannel) return

  // il layer attivo trascina con sé i layer collegati (syncTargetIds): si inviano tutte le
  // palette effettivamente cambiate, non solo quella del layer su cui gira il loop
  const after = useLayersStore.getState().layers
  const entries = after
    .filter((l, i) => before[i]?.palette !== l.palette)
    .map((l) => [l.id, l.palette.colors] as [string, RGB[]])
  if (entries.length === 0) return
  const payload: PalettePayload = { type: 'palette', entries }
  controlChannel.postMessage(payload)
}

/**
 * Manda in onda il media di turno della playlist di asset di un layer.
 *
 * Stesso ragionamento di `applyPaletteTick`: un cambio di clip non è una modifica in preparazione,
 * è il contenuto della scena **già in onda** che scorre. Quindi viaggia anche in modalità Live,
 * senza far scattare il badge delle modifiche non inviate, e sostituisce la ripubblicazione
 * dell'intera scena (all'Output serve un solo layer, non l'elenco completo).
 *
 * Il blob non c'è per costruzione (vedi `assetUrl`): all'Output arriva l'object URL, che è
 * risolvibile cross-window finché la finestra Control lo tiene vivo.
 */
export function applyAssetTick(layerId: string, media: MediaAsset) {
  mediaTickInFlight = true
  try {
    useLayersStore.getState().setLayerMedia(layerId, media)
  } finally {
    mediaTickInFlight = false
  }
  lastAssetMedia.set(layerId, media)
  if (!controlChannel) return
  const payload: MediaPayload = { type: 'media', layerId, media }
  controlChannel.postMessage(payload)
}

/** La playlist di quel layer si è fermata: l'Output torna a seguire lo stato di scena. */
export function forgetAssetMedia(layerId: string) {
  lastAssetMedia.delete(layerId)
}

/**
 * Da chiamare nella finestra di Controllo: pubblica lo stato all'Output.
 * In modalità Live gli aggiornamenti automatici sono sospesi: l'Output resta all'ultimo stato
 * inviato (memorizzato in lastPayload) finché non si preme "Esegui in output" o si esce da Live.
 */
export function useBroadcastPublisher() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    controlChannel = channel

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
      if (paletteTickInFlight || mediaTickInFlight) return // già in viaggio sul suo canale dedicato
      if (useOutputStore.getState().live) useOutputStore.getState().markDirty()
      else publishNow()
    }
    const unsubLayers = useLayersStore.subscribe(onLayersChange)

    // impostazioni di resa: fuori dal ciclo Live, sempre in viaggio (vedi RenderPayload)
    const unsubRender = useRenderStore.subscribe((s) => {
      const payload: RenderPayload = { type: 'render', settings: renderSettingsOf(s) }
      channel.postMessage(payload)
    })

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

    // una finestra Output appena aperta riceve l'ultimo stato inviato (in Live, quello committato),
    // con le palette aggiornate al momento: i tick del loop non passano da lastPayload, quindi
    // altrimenti la nuova finestra ripartirebbe dai colori del push e resterebbe indietro fino al
    // ciclo successivo
    channel.onmessage = (event) => {
      if (event.data?.type !== 'hello') return
      // le impostazioni di resa non passano da lastPayload: la finestra appena aperta le riceve qui
      const renderPayload: RenderPayload = {
        type: 'render',
        settings: renderSettingsOf(useRenderStore.getState()),
      }
      channel.postMessage(renderPayload)
      const current = new Map(useLayersStore.getState().layers.map((l) => [l.id, l.palette]))
      channel.postMessage({
        ...lastPayload,
        layers: lastPayload.layers.map((l) => {
          const palette = current.get(l.id)
          const withPalette = palette ? { ...l, palette: { ...l.palette, colors: palette.colors } } : l
          // stesso discorso per la playlist di asset: le sue clip viaggiano sul canale 'media' e
          // non passano da lastPayload. Si ripara solo il media messo dalla playlist, non quello
          // cambiato a mano, che in Live è a tutti gli effetti una modifica non ancora inviata.
          const clip = lastAssetMedia.get(l.id)
          return clip ? { ...withPalette, media: clip } : withPalette
        }),
      })
    }

    publishNow()

    return () => {
      unsubLayers()
      unsubOutput()
      unsubRender()
      if (controlChannel === channel) controlChannel = null
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
      // tick del loop palette: si applica solo ai layer presenti nella scena in onda, così in
      // Live i colori di una scena ancora in preparazione non entrano dalla porta di servizio
      if (event.data?.type === 'palette') {
        const { layers, setLayerPaletteColors } = useLayersStore.getState()
        for (const [layerId, colors] of (event.data as PalettePayload).entries) {
          if (layers.some((l) => l.id === layerId)) setLayerPaletteColors(layerId, colors)
        }
        return
      }
      // clip della playlist di asset: come i tick di palette, si applica solo se quel layer fa
      // parte della scena in onda, così in Live il contenuto di una scena ancora in preparazione
      // non entra dalla porta di servizio
      if (event.data?.type === 'media') {
        const { layerId, media } = event.data as MediaPayload
        const { layers, setLayerMedia } = useLayersStore.getState()
        if (layers.some((l) => l.id === layerId)) setLayerMedia(layerId, media)
        return
      }
      // impostazioni di resa: si applicano subito, anche mentre l'Output è congelato in Live
      if (event.data?.type === 'render') {
        useRenderStore.getState().applyRemote((event.data as RenderPayload).settings)
        return
      }
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
