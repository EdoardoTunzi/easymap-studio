import * as THREE from 'three'
import { FALLBACK_TEXTURE } from './mediaTexture'

/**
 * Copia di ciò che è già stato disegnato ("backdrop"), per i blend mode che il blending
 * hardware non sa calcolare.
 *
 * WebGL compone i layer con `src·fattore OP dst·fattore`: da lì escono Normal, Add, Screen e
 * Multiply, e nient'altro. Overlay, Soft/Hard Light, Difference, Exclusion, Darken, Lighten,
 * Color Burn e Color Dodge sono formule che devono **leggere** il colore sottostante — cosa
 * che un fragment shader non può fare sul framebuffer su cui sta scrivendo. La via percorribile
 * senza riscrivere l'intera pipeline in multi-pass è copiare il framebuffer in una texture
 * subito prima di disegnare il layer interessato (`onBeforeRender` della sua mesh) e passargliela
 * come uniform: lo shader calcola il blend e scrive il risultato già composto.
 *
 * La texture è **una sola e condivisa**: i layer si disegnano in sequenza, e ciascuno la
 * riscrive al proprio turno con lo stato aggiornato di quelli sotto. Il costo è una copia
 * a schermo pieno per ogni layer con blend avanzato, quindi zero per una scena che non ne usa.
 */

let texture: THREE.FramebufferTexture | null = null
const bufferSize = new THREE.Vector2()

/** Texture del backdrop (FALLBACK finché non è stata catturata almeno una volta). */
export function getBackdropTexture(): THREE.Texture {
  return texture ?? FALLBACK_TEXTURE
}

/** Dimensioni in pixel del buffer di disegno: servono allo shader per campionare in screen space. */
export function getBackdropSize(): THREE.Vector2 {
  return bufferSize
}

/** Fotografa il framebuffer corrente. Da chiamare prima di disegnare un layer a blend avanzato. */
export function captureBackdrop(renderer: THREE.WebGLRenderer) {
  renderer.getDrawingBufferSize(bufferSize)
  const width = Math.max(1, Math.floor(bufferSize.x))
  const height = Math.max(1, Math.floor(bufferSize.y))
  if (!texture || texture.image.width !== width || texture.image.height !== height) {
    texture?.dispose()
    texture = new THREE.FramebufferTexture(width, height)
    // nessun filtro né mipmap: è una copia 1:1 dei pixel a schermo, campionata alle stesse coordinate
    texture.minFilter = THREE.NearestFilter
    texture.magFilter = THREE.NearestFilter
    texture.generateMipmaps = false
  }
  renderer.copyFramebufferToTexture(texture)
}
