import { create } from 'zustand'
import { parseShader, type ParsedShader } from '../engine/isfParser'

// Carica automaticamente tutti gli shader .glsl della cartella: basta aggiungere un file.
const shaderModules = import.meta.glob('../shaders/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export const builtInShaders: ParsedShader[] = Object.entries(shaderModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => parseShader(src))

export const DEFAULT_SIZE = 1

/** Nome dello shader di default per un nuovo layer (il primo in ordine alfabetico). */
export const DEFAULT_SHADER_NAME = builtInShaders[0]?.name ?? ''

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
