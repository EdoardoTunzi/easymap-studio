import * as THREE from 'three'
import { parseGIF, decompressFrames, type ParsedFrame } from 'gifuct-js'
import type { MediaAsset } from '../store/projectStore'
import { acquireCameraStream, dropCameraStream, releaseCameraStream } from '../lib/cameraSources'
import { releaseTexture, trackTexture } from './textureQuality'

/**
 * Spazio colore delle sorgenti: **nessuna conversione**, i byte del file arrivano allo shader
 * come sono.
 *
 * Marcarle `SRGBColorSpace` — come si faceva prima — dice a Three di caricarle in un formato
 * `SRGB8_ALPHA8`, e da lì l'hardware le linearizza a ogni prelievo. Il guadagno ci sarebbe se
 * l'immagine venisse poi ri-codificata in uscita, ma i nostri layer sono `ShaderMaterial` con
 * sorgente scritta a mano: Three inserisce la conversione finale solo nei materiali che includono
 * il chunk `colorspace_fragment`, e il nostro wrapper non lo fa. Risultato: mezza conversione,
 * cioè una foto proiettata molto più scura e contrastata dell'originale (un grigio 50% finiva a
 * circa 21%). Le ombre si chiudevano e la sagoma perdeva stacco proprio dove serve.
 *
 * La pipeline lavora quindi tutta in spazio gamma, che è anche lo spazio in cui sono pensati i
 * 100+ shader della libreria, le palette prese dai color picker e le formule dei blend mode
 * (Overlay, Soft Light e compagnia sono definiti su valori non lineari, come in Photoshop).
 */
export const SOURCE_COLOR_SPACE = THREE.NoColorSpace

/**
 * Controller di texture per una sorgente: immagine statica, video (VideoTexture) o GIF
 * animata (decodificata a frame su canvas). Espone la texture corrente, un tick per-frame
 * (per video/gif) e la pulizia delle risorse.
 */
export interface MediaTextureController {
  getTexture: () => THREE.Texture
  /** Da chiamare ogni frame con il tempo trascorso (s): avanza video/gif. */
  tick: (elapsed: number) => void
  dispose: () => void
}

const FALLBACK = (() => {
  const data = new Uint8Array([40, 40, 48, 255])
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
})()

export const FALLBACK_TEXTURE = FALLBACK

interface ImageEntry {
  /** Quanti controller la stanno usando. */
  refs: number
  /** FALLBACK finché la decodifica non è finita. */
  texture: THREE.Texture
  /** Rilascio ritardato in corso (nessun riferimento attivo, ma la texture è ancora viva). */
  release: ReturnType<typeof setTimeout> | null
}

/**
 * Texture delle immagini condivise per URL.
 *
 * Serve al crossfade degli invii all'Output: `beginSceneCrossfade` monta la scena uscente come
 * *nuovi* componenti (`out-<id>`), che senza cache ricreerebbero il controller da zero e
 * mostrerebbero la FALLBACK per tutta la decodifica del blob — cioè un lampo scuro proprio sulla
 * scena che in quel momento è a piena opacità. Con la cache la scena uscente riparte
 * dall'immagine già decodificata e la dissolvenza è pulita.
 *
 * Vale anche fuori dal crossfade: due layer con lo stesso asset (il duplicato in Add/Screen per i
 * bordi illuminati, per dirne una) ora decodificano e occupano memoria GPU una volta sola.
 *
 * Solo immagini statiche: video e GIF hanno uno stato di riproduzione per istanza (playhead,
 * frame corrente), condividerli legherebbe fra loro layer che devono restare indipendenti.
 */
const imageCache = new Map<string, ImageEntry>()

/** Attesa prima di liberare una texture senza più riferimenti. */
const IMAGE_RELEASE_MS = 10000

function createImageController(media: MediaAsset): MediaTextureController {
  const url = media.url
  let entry = imageCache.get(url)
  if (entry) {
    // un rilascio in attesa va annullato: la texture torna in uso
    if (entry.release != null) {
      clearTimeout(entry.release)
      entry.release = null
    }
  } else {
    entry = { refs: 0, texture: FALLBACK, release: null }
    imageCache.set(url, entry)
    new THREE.TextureLoader().load(url, (tex) => {
      tex.colorSpace = SOURCE_COLOR_SPACE
      const current = imageCache.get(url)
      if (!current) {
        tex.dispose() // già liberata mentre decodificava
        return
      }
      // il corner-pin guarda l'immagine di sbieco: senza filtro anisotropico i lati inclinati
      // perdono dettaglio molto prima di quelli frontali (vedi textureQuality.ts)
      current.texture = trackTexture(tex)
    })
  }
  entry.refs++
  let released = false
  return {
    // letta dalla mappa, non dalla chiusura: chi monta prima della fine della decodifica
    // deve vedere la texture non appena arriva
    getTexture: () => imageCache.get(url)?.texture ?? FALLBACK,
    tick: () => {},
    dispose: () => {
      if (released) return
      released = true
      const current = imageCache.get(url)
      if (!current) return
      current.refs--
      if (current.refs > 0 || current.release != null) return
      // rilascio ritardato: un cambio di scena smonta i vecchi componenti prima di montare i
      // nuovi, quindi senza attesa la stessa immagine verrebbe buttata e ricaricata subito dopo
      current.release = setTimeout(() => {
        const e = imageCache.get(url)
        if (!e || e.refs > 0) return
        imageCache.delete(url)
        if (e.texture !== FALLBACK) {
          releaseTexture(e.texture)
          e.texture.dispose()
        }
      }, IMAGE_RELEASE_MS)
    },
  }
}

function createVideoController(media: MediaAsset): MediaTextureController {
  const video = document.createElement('video')
  video.src = media.url
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.crossOrigin = 'anonymous'
  video.play().catch(() => {
    /* autoplay può fallire finché non c'è interazione: la texture resta nera fino al play */
  })
  const texture = new THREE.VideoTexture(video)
  texture.colorSpace = THREE.SRGBColorSpace
  return {
    getTexture: () => texture,
    tick: () => {
      // VideoTexture si aggiorna da sé solo se è la .map di un materiale; qui è un uniform,
      // quindi forziamo l'upload quando ci sono nuovi dati.
      if (video.readyState >= video.HAVE_CURRENT_DATA) texture.needsUpdate = true
    },
    dispose: () => {
      video.pause()
      video.removeAttribute('src')
      video.load()
      texture.dispose()
    },
  }
}

interface CameraEntry {
  /** Quanti layer stanno riprendendo questa camera. */
  refs: number
  video: HTMLVideoElement
  texture: THREE.VideoTexture
  release: ReturnType<typeof setTimeout> | null
  /** Riagganci già tentati dopo la morte di un track: evita di martellare un device sparito. */
  recoveries: number
}

/**
 * Camere già aperte in questa finestra, per deviceId.
 *
 * A differenza dei video da file (playhead indipendente per layer) una sorgente live è la stessa
 * immagine per tutti: condividere elemento video e texture è corretto e permette di impilare più
 * layer sulla stessa ripresa — la ripresa del DJ con tre effetti diversi — con un solo stream
 * aperto e un solo upload di frame sulla GPU.
 */
const cameraCache = new Map<string, CameraEntry>()

/** Attesa prima di smontare una camera senza più layer (vedi imageCache: i cambi di scena). */
const CAMERA_RELEASE_MS = 4000

/** Pausa prima di riagganciare un device morto, e quante volte insistere. */
const RECOVERY_DELAY_MS = 1200
const MAX_RECOVERIES = 5

/** Aggancia lo stream all'elemento video e resta in ascolto della morte del track. */
function attachStream(key: string, entry: CameraEntry, stream: MediaStream) {
  // smontata mentre il browser apriva il device: non agganciare nulla
  if (cameraCache.get(key) !== entry) return
  entry.video.srcObject = stream
  void entry.video.play().catch(() => {
    /* niente autoplay senza interazione: resta la FALLBACK finché il play non riesce */
  })
  const track = stream.getVideoTracks()[0]
  track?.addEventListener('ended', () => recoverCamera(key, entry), { once: true })
}

/**
 * Riapre la camera quando il suo track muore: cam staccata e rimessa, device rubato da un'altra
 * app, risveglio del sistema. Senza questo il layer resterebbe congelato sull'ultimo frame fino
 * a un intervento manuale — inaccettabile a metà set.
 */
function recoverCamera(key: string, entry: CameraEntry) {
  if (cameraCache.get(key) !== entry || entry.refs <= 0) return
  if (entry.recoveries >= MAX_RECOVERIES) return
  entry.recoveries++
  dropCameraStream(key) // lo stream in cache è morto: via, così il prossimo acquire riapre davvero
  setTimeout(() => {
    if (cameraCache.get(key) !== entry || entry.refs <= 0) return
    acquireCameraStream(key)
      .then((stream) => attachStream(key, entry, stream))
      .catch(() => {
        /* device ancora assente: si riproverà al prossimo evento o al riavvio manuale */
      })
  }, RECOVERY_DELAY_MS)
}

/**
 * Chiude immediatamente una camera (texture, elemento video e stream) senza attese.
 * Serve al pulsante di riavvio: i controller montati tornano alla FALLBACK e la sorgente
 * riparte pulita al montaggio successivo.
 */
export function dropCameraTexture(deviceId: string) {
  const key = deviceId ?? ''
  const entry = cameraCache.get(key)
  if (entry) {
    if (entry.release != null) clearTimeout(entry.release)
    cameraCache.delete(key)
    entry.video.pause()
    entry.video.srcObject = null
    entry.texture.dispose()
  }
  dropCameraStream(key)
}

function createCameraController(media: MediaAsset): MediaTextureController {
  const key = media.deviceId ?? ''
  let entry = cameraCache.get(key)
  if (entry) {
    if (entry.release != null) {
      clearTimeout(entry.release)
      entry.release = null
    }
  } else {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    const texture = new THREE.VideoTexture(video)
    texture.colorSpace = SOURCE_COLOR_SPACE
    const created: CameraEntry = { refs: 0, video, texture, release: null, recoveries: 0 }
    cameraCache.set(key, created)
    acquireCameraStream(key)
      .then((stream) => attachStream(key, created, stream))
      .catch(() => {
        // permesso negato o device assente: la texture resta la FALLBACK e la UI mostra l'errore
        if (cameraCache.get(key) === created) cameraCache.delete(key)
      })
    entry = created
  }
  entry.refs++
  let released = false
  return {
    // finché non arriva il primo frame si mostra la FALLBACK: un VideoTexture senza dati
    // disegnerebbe un rettangolo nero (o l'ultimo frame di un'altra texture) sul layer
    getTexture: () => {
      const current = cameraCache.get(key)
      if (!current) return FALLBACK
      return current.video.readyState >= current.video.HAVE_CURRENT_DATA
        ? current.texture
        : FALLBACK
    },
    tick: () => {
      const current = cameraCache.get(key)
      if (!current) return
      // come per i video da file: la texture è un uniform, non la .map di un materiale,
      // quindi l'upload va forzato quando ci sono nuovi dati
      if (current.video.readyState >= current.video.HAVE_CURRENT_DATA) {
        current.texture.needsUpdate = true
        // un elemento video può finire in pausa da solo (throttling della finestra in secondo
        // piano, primo play rifiutato): riavviarlo qui evita l'immagine congelata
        if (current.video.paused) void current.video.play().catch(() => {})
      }
    },
    dispose: () => {
      if (released) return
      released = true
      const current = cameraCache.get(key)
      // entry già sparita = apertura fallita: lo stream non è mai stato agganciato, niente
      // da restituire (acquire e release sono appaiati al ciclo di vita dell'entry)
      if (!current) return
      current.refs--
      if (current.refs > 0 || current.release != null) return
      current.release = setTimeout(() => {
        const e = cameraCache.get(key)
        if (!e || e.refs > 0) return
        cameraCache.delete(key)
        e.video.pause()
        e.video.srcObject = null
        e.texture.dispose()
        releaseCameraStream(key)
      }, CAMERA_RELEASE_MS)
    },
  }
}

/** Renderer di GIF animate: compone i frame (con disposal) su un canvas e ne fa una CanvasTexture. */
class GifController implements MediaTextureController {
  private canvas = document.createElement('canvas')
  private ctx: CanvasRenderingContext2D
  private patchCanvas = document.createElement('canvas')
  private patchCtx: CanvasRenderingContext2D
  private texture: THREE.CanvasTexture
  private frames: ParsedFrame[] = []
  private index = 0
  private acc = 0
  private last = -1
  private ready = false

  constructor(media: MediaAsset) {
    this.ctx = this.canvas.getContext('2d')!
    this.patchCtx = this.patchCanvas.getContext('2d')!
    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = SOURCE_COLOR_SPACE
    trackTexture(this.texture)
    void this.load(media)
  }

  private async load(media: MediaAsset) {
    const buf = media.blob
      ? await media.blob.arrayBuffer()
      : await (await fetch(media.url)).arrayBuffer()
    const gif = parseGIF(buf)
    const frames = decompressFrames(gif, true)
    if (frames.length === 0) return
    this.frames = frames
    this.canvas.width = gif.lsd.width
    this.canvas.height = gif.lsd.height
    this.renderFrame(0)
    this.ready = true
  }

  private renderFrame(i: number) {
    const frame = this.frames[i]
    // disposal 2 = ripristina l'area del frame precedente a "sfondo" (trasparente)
    if (i > 0 && this.frames[i - 1].disposalType === 2) {
      const prev = this.frames[i - 1].dims
      this.ctx.clearRect(prev.left, prev.top, prev.width, prev.height)
    }
    const { width, height, top, left } = frame.dims
    this.patchCanvas.width = width
    this.patchCanvas.height = height
    const imageData = this.patchCtx.createImageData(width, height)
    imageData.data.set(frame.patch)
    this.patchCtx.putImageData(imageData, 0, 0)
    this.ctx.drawImage(this.patchCanvas, left, top)
    this.texture.needsUpdate = true
  }

  getTexture() {
    return this.ready ? this.texture : FALLBACK
  }

  tick(elapsed: number) {
    if (!this.ready || this.frames.length < 2) return
    if (this.last < 0) {
      this.last = elapsed
      return
    }
    const dt = (elapsed - this.last) * 1000
    this.last = elapsed
    this.acc += dt
    let guard = 0
    // delay dei frame gifuct è in ms (minimo 20ms per GIF senza delay dichiarato)
    while (this.acc >= Math.max(this.frames[this.index].delay, 20) && guard < this.frames.length) {
      this.acc -= Math.max(this.frames[this.index].delay, 20)
      this.index = (this.index + 1) % this.frames.length
      this.renderFrame(this.index)
      guard++
    }
  }

  dispose() {
    releaseTexture(this.texture)
    this.texture.dispose()
  }
}

export function createMediaTexture(media: MediaAsset): MediaTextureController {
  if (media.type === 'camera') return createCameraController(media)
  if (media.type === 'video') return createVideoController(media)
  if (media.type === 'gif') return new GifController(media)
  return createImageController(media)
}

// Stessa ragione di cameraSources: le cache di texture vivono nel modulo, un hot-replace le
// sdoppierebbe lasciando i controller montati agganciati a quelle vecchie.
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
