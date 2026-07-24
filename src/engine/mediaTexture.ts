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

function createImageController(media: MediaAsset): MediaTextureController {
  let texture: THREE.Texture = FALLBACK
  let disposed = false
  const loader = new THREE.TextureLoader()
  loader.load(media.url, (tex) => {
    if (disposed) {
      tex.dispose()
      return
    }
    tex.colorSpace = THREE.SRGBColorSpace
    texture = tex
  })
  return {
    getTexture: () => texture,
    tick: () => {},
    dispose: () => {
      disposed = true
      if (texture !== FALLBACK) texture.dispose()
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
