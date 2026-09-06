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
  /**
   * La dissolvenza è per-layer (transizioni già dentro `layers`, che l'Output anima da sé) invece
   * che di scena. La usano i motori automatici: cambiano SOLO l'effetto di alcuni layer, quindi
   * duplicare l'intera scena costerebbe il doppio della GPU e, per un layer con video o GIF,
   * farebbe ripartire da zero una seconda istanza del media proprio mentre è a piena opacità.
   * Il crossfade di scena resta per gli invii manuali, dove può cambiare qualsiasi cosa.
   */
  layerFade?: boolean
}

/** Durata della dissolvenza scelta nella barra playlist (0 se la transizione è impostata su "secca"). */
function pushFadeDuration(): number {
  const { transitionMode, transitionDuration } = usePlaylistStore.getState()
  return transitionMode === 'smooth' ? transitionDuration : 0
}

type LayersSnapshot = ReturnType<typeof useLayersStore.getState>

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

/** Come sopra, per i cambi di scena dei motori automatici: li pubblica `airScene`, una volta sola. */
let sceneTickInFlight = false

/** `publishNow` del publisher montato, esposto ai motori automatici (vedi `airScene`). */
let publishNowRef: ((fadeDuration: number, layerFade?: boolean) => void) | null = null

/**
 * Manda in onda un cambio di scena automatico (clip di playlist, colonna di combo): applica il
 * cambio nel Control e spedisce all'Output **la scena d'arrivo con la sua dissolvenza**, un
 * messaggio solo.
 *
 * Stesso ragionamento di `applyPaletteTick`/`applyAssetTick`: non è una modifica in preparazione,
 * è la scena già in onda che avanza, quindi viaggia anche in Live senza accendere il badge delle
 * modifiche non inviate.
 *
 * Perché non lasciar fare al mirroring, fuori da Live: il publisher rispecchia ogni scrittura,
 * quindi il crossfade arrivava al proiettore come ~60 invii dell'intera scena al secondo, e la
 * sua fluidità dipendeva dal canale invece che dal suo frame loop. Ora l'Output riceve il punto
 * d'arrivo e anima da sé, esattamente come già faceva in Live.
 */
export function airScene(apply: () => void, fadeDuration = 0) {
  sceneTickInFlight = true
  try {
    apply()
  } finally {
    sceneTickInFlight = false
  }
  publishNowRef?.(fadeDuration, true)
}

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

    /** Stato d'arrivo di un layer: dissolvenze chiuse, e chi stava uscendo dalla scena spento. */
    const settled = (l: Layer) =>
      l.transition ? { ...l, transition: null, visible: l.transition.mode === 'out' ? false : l.visible } : l

    const buildPayload = (fadeDuration = 0, layerFade = false): Payload => {
      const { layers, activeLayerId, testPattern } = useLayersStore.getState()
      // I frame di una dissolvenza non viaggiano (`setTransitionProgress` non si pubblica): un
      // `transition` spedito e mai avanzato resterebbe congelato sull'effetto USCENTE. Quindi o
      // si manda lo stato d'arrivo (e la dissolvenza la fa l'Output di scena), oppure — con
      // `layerFade` — si mandano le transizioni appena nate e l'Output le anima lui.
      const strip = !layerFade && (fadeDuration > 0 || useOutputStore.getState().live)
      const out = stripBlobs(layers)
      return {
        type: 'state',
        layers: strip ? out.map(settled) : out,
        activeLayerId,
        testPattern,
        fadeDuration,
        layerFade,
      }
    }

    // ultimo stato effettivamente inviato: risponde agli "hello" delle finestre Output appena aperte
    let lastPayload = buildPayload()

    const publishNow = (fadeDuration = 0, layerFade = false) => {
      const payload = buildPayload(fadeDuration, layerFade)
      channel.postMessage(payload)
      // memorizzato senza dissolvenza e a dissolvenza conclusa: una finestra Output aperta più
      // tardi deve trovarsi subito la scena d'arrivo, non rigiocare una transizione già avvenuta
      lastPayload = { ...payload, fadeDuration: 0, layerFade: false, layers: payload.layers.map(settled) }
      useOutputStore.getState().clearDirty()
    }

    /**
     * I due elenchi differiscono solo per i frame di una dissolvenza per-layer? Oltre a
     * `transition` si tollera lo spegnimento con cui si chiude una dissolvenza in uscita: è
     * l'ultimo fotogramma dell'animazione, non una modifica della scena.
     */
    const onlyFadeFrame = (a: Layer[], b: Layer[]) =>
      a.length === b.length &&
      a.every((la, i) => {
        const lb = b[i]
        if (la === lb) return true
        const closingOut = la.transition?.mode === 'out' && !lb.visible
        for (const k of Object.keys(la) as (keyof Layer)[]) {
          if (k === 'transition') continue
          if (k === 'visible' && closingOut) continue
          if (la[k] !== lb[k]) return false
        }
        return true
      })

    // ad ogni modifica dei layer: se Live, marca "in sospeso"; altrimenti invia subito
    const onLayersChange = (state: LayersSnapshot, prev: LayersSnapshot) => {
      // già in viaggio sul suo canale dedicato (o, per la scena, spedito da `airScene`)
      if (paletteTickInFlight || mediaTickInFlight || sceneTickInFlight) return
      // un frame di dissolvenza è la scena in onda che si anima, non una modifica: in Live
      // terrebbe acceso il badge "Esegui in output", fuori da Live ripubblicherebbe l'intera
      // scena a ogni frame, scavalcando la dissolvenza che l'Output sta già animando da sé
      if (state.layers !== prev.layers && onlyFadeFrame(prev.layers, state.layers)) return
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
    publishNowRef = publishNow

    return () => {
      unsubLayers()
      unsubOutput()
      unsubRender()
      if (controlChannel === channel) controlChannel = null
      if (publishNowRef === publishNow) publishNowRef = null
      channel.close()
    }
  }, [])
}

/** Da chiamare nella finestra di Output: applica lo stato ricevuto dal Controllo. */
export function useBroadcastSubscriber() {
  useEffect(() => {
    const channel = new BroadcastChannel(CHANNEL_NAME)
    let fadeRaf: number | null = null

    /**
     * Anima le dissolvenze per-layer arrivate dentro la scena (`layerFade`). Stesso motore del
     * crossfade di scena, ma qui a sfumare è il solo effetto dei layer che sono cambiati: gli
     * altri, i media e il mapping restano dove sono.
     */
    const runLayerFade = (durationSec: number) => {
      if (fadeRaf != null) cancelAnimationFrame(fadeRaf)
      const start = performance.now()
      const durationMs = durationSec * 1000
      const step = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs)
        // a 1 le transizioni si chiudono, e i layer usciti dalla scena si spengono
        useLayersStore.getState().setTransitionProgress(progress)
        fadeRaf = progress < 1 ? requestAnimationFrame(step) : null
      }
      fadeRaf = requestAnimationFrame(step)
    }

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
      const { layers, activeLayerId, testPattern, fadeDuration, layerFade } = event.data
      if (layers) {
        if (fadeDuration > 0 && layerFade) {
          // setScene chiude un eventuale crossfade di scena: le transizioni appena arrivate
          // (progress 0) diventano l'unica dissolvenza in corso
          if (fadeRaf != null) cancelAnimationFrame(fadeRaf)
          useLayersStore.getState().setScene(layers, activeLayerId)
          runLayerFade(fadeDuration)
        } else if (fadeDuration > 0) {
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
