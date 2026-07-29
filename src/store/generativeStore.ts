import { create } from 'zustand'
import { parseShader, type ParsedShader } from '../engine/isfParser'
import {
  composeModuleSource,
  createModuleInstance,
  getModuleDef,
  randomizeSourceDefaults,
  type ModuleBlendMode,
  type ModuleInstance,
} from '../engine/generativeModules'
import type { RGB } from './paletteStore'

/**
 * Modalità di editing del draft:
 * - `modules`: la sorgente è ricomposta dallo stack a ogni modifica (i moduli sono la verità)
 * - `code`: l'utente ha editato il GLSL a mano, la sorgente è la verità e lo stack è congelato
 */
export type GenerativeMode = 'modules' | 'code'

export const DEFAULT_VISUAL_NAME = 'Visual generativo'

interface GenerativeState {
  /** Id del visual salvato in editing (null = draft mai salvato). */
  editingId: string | null
  name: string
  mode: GenerativeMode
  stack: ModuleInstance[]
  /** Sorgente GLSL corrente: sempre allineata (in modalità `modules` è ricomposta dallo stack). */
  source: string
  /** Shader compilato dalla sorgente corrente, o null se la sorgente non è parsabile. */
  shader: ParsedShader | null
  /**
   * Se true (default) ogni modifica del draft si riversa subito sul layer attivo, senza premere
   * nulla. Se false le modifiche restano nell'anteprima finché non si usa "Al layer attivo".
   */
  liveApply: boolean

  setName: (name: string) => void
  setMode: (mode: GenerativeMode) => void
  setLiveApply: (liveApply: boolean) => void

  addModule: (moduleId: string) => void
  removeModule: (instanceId: string) => void
  reorderModules: (from: number, to: number) => void
  setModuleParam: (instanceId: string, param: string, value: number) => void
  setModuleColorParam: (instanceId: string, param: string, rgb: RGB) => void
  setModuleWeight: (instanceId: string, weight: number) => void
  setModuleBlendMode: (instanceId: string, blendMode: ModuleBlendMode) => void

  /** Editing manuale del GLSL: passa in modalità `code`. */
  setSource: (source: string) => void
  /** Torna alla modalità `modules`, riallineando la sorgente allo stack (scarta le modifiche a mano). */
  recomposeFromModules: () => void

  /** Valori casuali entro i range per tutti i parametri (funziona in entrambe le modalità). */
  randomize: () => void

  /** Carica un visual salvato nell'editor. */
  loadVisual: (visual: {
    id: string
    name: string
    mode: GenerativeMode
    stack: ModuleInstance[]
    source: string
  }) => void
  /** Nuovo draft vuoto. */
  reset: () => void
  /** Segna il draft come salvato con l'id indicato (dopo una save su IndexedDB). */
  markSaved: (id: string, name: string) => void
}

/** Compila la sorgente; null se il GLSL non è parsabile (nome/processColor mancanti). */
function compile(source: string): ParsedShader | null {
  try {
    const shader = parseShader(source)
    return shader.raw.includes('processColor') ? shader : null
  } catch {
    return null
  }
}

/** Stato derivato dallo stack: sorgente ricomposta + shader compilato. */
function fromStack(name: string, stack: ModuleInstance[]) {
  const source = composeModuleSource(name, stack)
  return { source, shader: compile(source) }
}

const DRAFT_KEY = 'easyvj-generative-draft'

/** Sottoinsieme del draft che vale la pena ricordare tra un reload e l'altro. */
interface StoredDraft {
  editingId: string | null
  name: string
  mode: GenerativeMode
  stack: ModuleInstance[]
  source: string
  liveApply: boolean
}

/**
 * Il draft sopravvive al reload: senza, riaprendo l'app si ripartiva da un draft vuoto con
 * `editingId` perso, e il Salva successivo creava un duplicato invece di aggiornare il visual.
 */
function loadDraft(): StoredDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as StoredDraft
    return typeof d?.source === 'string' && Array.isArray(d.stack) ? d : null
  } catch {
    return null
  }
}

function saveDraft(d: StoredDraft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // quota piena o storage non disponibile: il draft resta comunque in memoria
  }
}

function initialState() {
  const stored = loadDraft()
  if (stored) {
    return {
      editingId: stored.editingId ?? null,
      name: stored.name,
      mode: stored.mode,
      stack: stored.stack,
      source: stored.source,
      shader: compile(stored.source),
      liveApply: stored.liveApply ?? true,
    }
  }
  const stack = [createModuleInstance('flowField')]
  return {
    editingId: null,
    name: DEFAULT_VISUAL_NAME,
    mode: 'modules' as GenerativeMode,
    stack,
    liveApply: true,
    ...fromStack(DEFAULT_VISUAL_NAME, stack),
  }
}

export const useGenerativeStore = create<GenerativeState>((set, get) => {
  /** Applica una patch a un'istanza dello stack e ricompone (solo in modalità `modules`). */
  const patchInstance = (instanceId: string, patch: (inst: ModuleInstance) => ModuleInstance) =>
    set((state) => {
      if (state.mode !== 'modules') return state
      const stack = state.stack.map((inst) => (inst.instanceId === instanceId ? patch(inst) : inst))
      return { stack, ...fromStack(state.name, stack) }
    })

  return {
    ...initialState(),

    setLiveApply: (liveApply) => set({ liveApply }),

    setName: (name) =>
      set((state) => {
        // in modalità codice il nome vive dentro il commento `// NAME:` della sorgente scritta
        // dall'utente: non lo si riscrive, si aggiorna solo l'etichetta del draft
        if (state.mode !== 'modules') return { name }
        return { name, ...fromStack(name, state.stack) }
      }),

    setMode: (mode) => set({ mode }),

    addModule: (moduleId) =>
      set((state) => {
        if (!getModuleDef(moduleId)) return state
        const stack = [...state.stack, createModuleInstance(moduleId, state.stack)]
        return { stack, mode: 'modules' as const, ...fromStack(state.name, stack) }
      }),

    removeModule: (instanceId) =>
      set((state) => {
        const stack = state.stack.filter((inst) => inst.instanceId !== instanceId)
        return { stack, ...fromStack(state.name, stack) }
      }),

    reorderModules: (from, to) =>
      set((state) => {
        if (from === to || from < 0 || to < 0) return state
        if (from >= state.stack.length || to >= state.stack.length) return state
        const stack = [...state.stack]
        const [moved] = stack.splice(from, 1)
        stack.splice(to, 0, moved)
        return { stack, ...fromStack(state.name, stack) }
      }),

    setModuleParam: (instanceId, param, value) =>
      patchInstance(instanceId, (inst) => ({ ...inst, params: { ...inst.params, [param]: value } })),

    setModuleColorParam: (instanceId, param, rgb) =>
      patchInstance(instanceId, (inst) => ({
        ...inst,
        colorParams: { ...inst.colorParams, [param]: rgb },
      })),

    setModuleWeight: (instanceId, weight) =>
      patchInstance(instanceId, (inst) => ({ ...inst, weight })),

    setModuleBlendMode: (instanceId, blendMode) =>
      patchInstance(instanceId, (inst) => ({ ...inst, blendMode })),

    // il guard sull'uguaglianza evita che l'editor, ri-sincronizzandosi con una sorgente
    // ricomposta dai moduli, faccia scattare da solo il passaggio in modalità codice
    setSource: (source) =>
      set((state) =>
        source === state.source ? state : { source, shader: compile(source), mode: 'code' },
      ),

    recomposeFromModules: () =>
      set((state) => ({ mode: 'modules' as const, ...fromStack(state.name, state.stack) })),

    randomize: () =>
      set((state) => {
        // in modalità codice non c'è uno stack da mutare: si riscrivono i @default della sorgente
        if (state.mode === 'code') {
          const source = randomizeSourceDefaults(state.source)
          return { source, shader: compile(source) }
        }
        const stack = state.stack.map((inst) => {
          const def = getModuleDef(inst.moduleId)
          if (!def) return inst
          const params = Object.fromEntries(
            def.controls.map((c) => [c.name, c.min + Math.random() * (c.max - c.min)]),
          )
          return { ...inst, params }
        })
        return { stack, ...fromStack(state.name, stack) }
      }),

    loadVisual: ({ id, name, mode, stack, source }) =>
      set({ editingId: id, name, mode, stack, source, shader: compile(source) }),

    reset: () => {
      const name = DEFAULT_VISUAL_NAME
      const stack = [createModuleInstance('flowField')]
      set({ editingId: null, name, mode: 'modules', stack, ...fromStack(name, stack) })
    },

    markSaved: (id, name) => set({ editingId: id, name: name || get().name }),
  }
})

// Il draft segue ogni modifica in localStorage, così ricaricando l'app si riprende esattamente
// da dove si era e il Salva successivo aggiorna il visual invece di crearne una copia.
useGenerativeStore.subscribe((s) =>
  saveDraft({
    editingId: s.editingId,
    name: s.name,
    mode: s.mode,
    stack: s.stack,
    source: s.source,
    liveApply: s.liveApply,
  }),
)
