import { create } from 'zustand'
import { type Palette, type RGB, createDefaultPalette } from './paletteStore'
import { DEFAULT_SIZE, defaultParamsFor, defaultColorsFor } from './effectsStore'
import type { ParsedShader } from '../engine/isfParser'

/**
 * Un clip della playlist: un "look" completo (shader + parametri + size + palette) con una
 * durata. Come i preset, NON include media/posizionamento: è riapplicabile su qualsiasi layer.
 */
export interface PlaylistClip {
  id: string
  name: string
  shaderName: string
  params: Record<string, number>
  /** Valori degli uniform colore (vec3) dello shader. */
  colors: Record<string, RGB>
  size: number
  palette: Palette
  /** Durata in secondi. */
  duration: number
}

export type TransitionMode = 'cut' | 'smooth'

export const MIN_CLIP_DURATION = 0.5
export const MAX_CLIP_DURATION = 600
export const DEFAULT_CLIP_DURATION = 5

/** Sottoinsieme persistibile della playlist (entra nello snapshot del progetto). */
export interface PlaylistData {
  clips: PlaylistClip[]
  transitionMode: TransitionMode
  transitionDuration: number
  loop: boolean
}

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) }
}

function cloneClip(clip: PlaylistClip): PlaylistClip {
  return {
    ...clip,
    params: { ...clip.params },
    // clip salvati prima della feature colori non hanno il campo: normalizza a {}
    colors: Object.fromEntries(
      Object.entries(clip.colors ?? {}).map(([k, v]) => [k, [...v] as RGB]),
    ),
    palette: clonePalette(clip.palette),
  }
}

const clampDuration = (d: number) =>
  Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, d))

interface PlaylistState extends PlaylistData {
  /** Riproduzione in corso (il motore vive nella barra della Control page). */
  playing: boolean
  /** Indice del clip corrente. */
  currentIndex: number
  /** Avanzamento 0..1 dentro il clip corrente (solo per il playhead UI). */
  clipProgress: number
  /** Clip con l'editor aperto. null = nessuno. */
  editingClipId: string | null

  addClipFromShader: (shader: ParsedShader) => string
  addClip: (partial: Omit<PlaylistClip, 'id'>) => string
  removeClip: (id: string) => void
  duplicateClip: (id: string) => void
  updateClip: (id: string, patch: Partial<Omit<PlaylistClip, 'id'>>) => void
  reorderClips: (from: number, to: number) => void

  setPlaying: (playing: boolean) => void
  setCurrentIndex: (index: number) => void
  setClipProgress: (progress: number) => void
  setTransitionMode: (mode: TransitionMode) => void
  setTransitionDuration: (seconds: number) => void
  setLoop: (loop: boolean) => void
  setEditingClip: (id: string | null) => void

  /** Sostituisce i dati persistibili (usato da persistence al load del progetto). */
  setPlaylistData: (data: PlaylistData | undefined) => void
}

const DEFAULT_DATA: PlaylistData = {
  clips: [],
  transitionMode: 'smooth',
  transitionDuration: 1,
  loop: true,
}

export const usePlaylistStore = create<PlaylistState>((set, get) => ({
  ...DEFAULT_DATA,
  playing: false,
  currentIndex: 0,
  clipProgress: 0,
  editingClipId: null,

  addClipFromShader: (shader) =>
    get().addClip({
      name: shader.name,
      shaderName: shader.name,
      params: defaultParamsFor(shader),
      colors: defaultColorsFor(shader),
      size: DEFAULT_SIZE,
      palette: createDefaultPalette(),
      duration: DEFAULT_CLIP_DURATION,
    }),

  addClip: (partial) => {
    const id = crypto.randomUUID()
    set((s) => ({
      clips: [...s.clips, { ...cloneClip({ ...partial, id }), id }],
    }))
    return id
  },

  removeClip: (id) =>
    set((s) => {
      const index = s.clips.findIndex((c) => c.id === id)
      const clips = s.clips.filter((c) => c.id !== id)
      let currentIndex = s.currentIndex
      if (index !== -1 && index < currentIndex) currentIndex -= 1
      currentIndex = Math.min(currentIndex, Math.max(clips.length - 1, 0))
      return {
        clips,
        currentIndex,
        playing: clips.length === 0 ? false : s.playing,
        editingClipId: s.editingClipId === id ? null : s.editingClipId,
      }
    }),

  duplicateClip: (id) =>
    set((s) => {
      const index = s.clips.findIndex((c) => c.id === id)
      if (index === -1) return s
      const copy = { ...cloneClip(s.clips[index]), id: crypto.randomUUID() }
      const clips = [...s.clips]
      clips.splice(index + 1, 0, copy)
      return { clips }
    }),

  updateClip: (id, patch) =>
    set((s) => ({
      clips: s.clips.map((c) =>
        c.id === id
          ? {
              ...c,
              ...patch,
              duration: clampDuration(patch.duration ?? c.duration),
            }
          : c,
      ),
    })),

  reorderClips: (from, to) =>
    set((s) => {
      if (from === to || from < 0 || from >= s.clips.length) return s
      const clips = [...s.clips]
      const [moved] = clips.splice(from, 1)
      clips.splice(Math.min(to, clips.length), 0, moved)
      // il clip corrente resta lo stesso oggetto: segui il suo nuovo indice
      const currentId = s.clips[s.currentIndex]?.id
      const currentIndex = Math.max(clips.findIndex((c) => c.id === currentId), 0)
      return { clips, currentIndex }
    }),

  setPlaying: (playing) => set({ playing }),
  setCurrentIndex: (currentIndex) => set({ currentIndex, clipProgress: 0 }),
  setClipProgress: (clipProgress) => set({ clipProgress }),
  setTransitionMode: (transitionMode) => set({ transitionMode }),
  setTransitionDuration: (transitionDuration) =>
    set({ transitionDuration: Math.min(10, Math.max(0.1, transitionDuration)) }),
  setLoop: (loop) => set({ loop }),
  setEditingClip: (editingClipId) => set({ editingClipId }),

  setPlaylistData: (data) =>
    set({
      ...(data ?? DEFAULT_DATA),
      clips: (data?.clips ?? []).map(cloneClip),
      playing: false,
      currentIndex: 0,
      clipProgress: 0,
      editingClipId: null,
    }),
}))

/** Estrae il sottoinsieme persistibile (per lo snapshot del progetto). */
export function playlistSnapshot(): PlaylistData {
  const { clips, transitionMode, transitionDuration, loop } = usePlaylistStore.getState()
  return {
    clips: clips.map(cloneClip),
    transitionMode,
    transitionDuration,
    loop,
  }
}
