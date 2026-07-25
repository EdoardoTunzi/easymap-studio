import { create } from 'zustand'
import { parseShader, type ParsedShader } from '../engine/isfParser'
import type { RGB } from './paletteStore'

// Carica automaticamente tutti gli shader .glsl della cartella: basta aggiungere un file.
const shaderModules = import.meta.glob('../shaders/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Nome speciale dello shader "passthrough": il layer mostra il contenuto grezzo, senza effetto. */
export const NONE_SHADER_NAME = 'Nessun effetto'

// Shader passthrough: emette il contenuto così com'è (l'alpha finale è governato dalla maschera).
const NONE_SHADER_SRC = `// NAME: ${NONE_SHADER_NAME}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  return vec4(texture2D(tex, uv).rgb, 1.0);
}`

const fileShaders: ParsedShader[] = Object.entries(shaderModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => parseShader(src))

// "Nessun effetto" in cima alla libreria, poi gli shader dei file in ordine alfabetico.
const builtInShaders: ParsedShader[] = [parseShader(NONE_SHADER_SRC), ...fileShaders]

export const DEFAULT_SIZE = 1

/** Nome dello shader di default per un nuovo layer (il primo effetto reale, non "Nessun effetto"). */
export const DEFAULT_SHADER_NAME = fileShaders[0]?.name ?? NONE_SHADER_NAME

/** Valori di default degli uniform di uno shader. */
export function defaultParamsFor(shader: ParsedShader): Record<string, number> {
  return Object.fromEntries(shader.controls.map((c) => [c.name, c.default]))
}

interface EffectsState {
  /** Libreria globale di shader disponibili (sola lettura, derivata dai file). */
  shaders: ParsedShader[]
}

/**
 * Store della sola libreria shader. I parametri live (shader attivo, size, params) sono
 * ora per-layer e vivono in `layersStore.ts`.
 */
export const useEffectsStore = create<EffectsState>(() => ({
  shaders: builtInShaders,
}))

/** Valori di default degli uniform colore (vec3) di uno shader. */
export function defaultColorsFor(shader: ParsedShader): Record<string, RGB> {
  return Object.fromEntries(shader.colorControls.map((c) => [c.name, [...c.default] as RGB]))
}
