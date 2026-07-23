import { create } from 'zustand'
import { parseShader, type ParsedShader } from '../engine/isfParser'

// Carica automaticamente tutti gli shader .glsl della cartella: basta aggiungere un file.
const shaderModules = import.meta.glob('../shaders/*.glsl', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const builtInShaders: ParsedShader[] = Object.entries(shaderModules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, src]) => parseShader(src))

export const DEFAULT_SIZE = 1

interface EffectsState {
  shaders: ParsedShader[]
  activeShaderName: string
  /** Dimensione globale del pattern dello shader (uniform uScale), valida per tutti gli effetti. */
  size: number
  /** Valori correnti degli uniform live, per nome shader -> nome uniform -> valore */
  params: Record<string, Record<string, number>>
  setActiveShader: (name: string) => void
  setSize: (size: number) => void
  setParam: (shaderName: string, uniformName: string, value: number) => void
  getActiveShader: () => ParsedShader | undefined
}

function defaultParamsFor(shader: ParsedShader): Record<string, number> {
  return Object.fromEntries(shader.controls.map((c) => [c.name, c.default]))
}

export const useEffectsStore = create<EffectsState>((set, get) => ({
  shaders: builtInShaders,
  activeShaderName: builtInShaders[0]?.name ?? '',
  size: DEFAULT_SIZE,
  params: Object.fromEntries(
    builtInShaders.map((s) => [s.name, defaultParamsFor(s)]),
  ),
  setActiveShader: (name) => set({ activeShaderName: name }),
  setSize: (size) => set({ size }),
  setParam: (shaderName, uniformName, value) =>
    set((state) => ({
      params: {
        ...state.params,
        [shaderName]: {
          ...state.params[shaderName],
          [uniformName]: value,
        },
      },
    })),
  getActiveShader: () =>
    get().shaders.find((s) => s.name === get().activeShaderName),
}))
