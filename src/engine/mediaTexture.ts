import * as THREE from 'three'
import { parseGIF, decompressFrames, type ParsedFrame } from 'gifuct-js'
import type { MediaAsset } from '../store/projectStore'

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
      tex.colorSpace = THREE.SRGBColorSpace
      const current = imageCache.get(url)
      if (!current) {
        tex.dispose() // già liberata mentre decodificava
        return
      }
      current.texture = tex
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
        if (e.texture !== FALLBACK) e.texture.dispose()
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
    this.texture.colorSpace = THREE.SRGBColorSpace
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
    this.texture.dispose()
  }
}

export function createMediaTexture(media: MediaAsset): MediaTextureController {
  if (media.type === 'video') return createVideoController(media)
  if (media.type === 'gif') return new GifController(media)
  return createImageController(media)
}
