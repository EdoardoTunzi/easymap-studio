import * as THREE from 'three'
import { useEffectsStore } from '../store/effectsStore'
import type { EffectSnapshot } from '../store/layersStore'
import { buildUniforms } from './ShaderPlane'

/**
 * Genera thumbnail statiche degli effetti (per le card della playlist): un frame dello shader
 * renderizzato su un piccolo canvas WebGL offscreen condiviso, restituito come data URL.
 * Cache per look (shader + params + size + palette): il costo si paga una volta sola.
 */

const THUMB_W = 128
const THUMB_H = 72
/** Istante "rappresentativo" dell'animazione: un frame a metà movimento, non il t=0 spesso vuoto. */
const THUMB_TIME = 2.5

let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.OrthographicCamera | null = null
let mesh: THREE.Mesh | null = null

const cache = new Map<string, string>()

function ensureRenderer() {
  if (renderer) return
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    // necessario per leggere i pixel con toDataURL dopo il render
    preserveDrawingBuffer: true,
  })
  renderer.setSize(THUMB_W, THUMB_H)
  renderer.setClearColor(0x000000, 1)
  scene = new THREE.Scene()
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
  camera.position.z = 5
  mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2))
  scene.add(mesh)
}

/**
 * Thumbnail del look richiesto (sincrono, con cache). null se lo shader non esiste
 * o se il rendering fallisce (es. WebGL non disponibile).
 */
export function effectThumbnail(effect: EffectSnapshot): string | null {
  const shader = useEffectsStore.getState().shaders.find((s) => s.name === effect.shaderName)
  if (!shader) return null

  const p = effect.palette
  // shader.id nella chiave: un visual generativo rigenerato conserva il nome ma non l'aspetto,
  // e senza questo la cache restituirebbe la miniatura della versione precedente
  const key = JSON.stringify([
    shader.id,
    effect.params,
    effect.colors,
    effect.size,
    p.enabled,
    p.enabled ? [p.colors, p.count, p.amount] : null,
  ])
  const hit = cache.get(key)
  if (hit) return hit

  try {
    ensureRenderer()
    const uniforms = buildUniforms(shader)
    uniforms.uTime.value = THUMB_TIME
    ;(uniforms.uResolution.value as THREE.Vector2).set(THUMB_W, THUMB_H)
    uniforms.uScale.value = effect.size
    uniforms.uPaletteOn.value = p.enabled ? 1 : 0
    uniforms.uPaletteCount.value = p.count
    uniforms.uPaletteAmount.value = p.amount
    const palArr = uniforms.uPalette.value as THREE.Vector3[]
    for (let i = 0; i < palArr.length; i++) {
      const c = p.colors[i] ?? p.colors[p.colors.length - 1]
      palArr[i].set(c[0], c[1], c[2])
    }
    for (const control of shader.controls) {
      const uniform = uniforms[control.name]
      if (uniform) uniform.value = effect.params[control.name] ?? control.default
    }
    for (const color of shader.colorControls) {
      const uniform = uniforms[color.name]
      if (uniform) {
        const c = effect.colors[color.name] ?? color.default
        ;(uniform.value as THREE.Vector3).set(c[0], c[1], c[2])
      }
    }

    const material = new THREE.ShaderMaterial({
      vertexShader: shader.vertexShader,
      fragmentShader: shader.fragmentShader,
      uniforms,
      transparent: true,
    })
    mesh!.material = material
    renderer!.render(scene!, camera!)
    const url = renderer!.domElement.toDataURL('image/png')
    material.dispose()

    if (cache.size > 200) cache.clear()
    cache.set(key, url)
    return url
  } catch {
    return null
  }
}
