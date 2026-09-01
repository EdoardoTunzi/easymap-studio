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

/**
 * La sequenza di un singolo layer. **Per layer** e non globale: prima la playlist scriveva sul
 * layer *attivo*, letto a ogni tick, quindi cambiando selezione la sequenza seguiva e riscriveva
 * l'effetto di un layer che non doveva averla — e non era possibile dare sequenze diverse a due
 * layer. Stessa scelta della playlist di asset (`assetPlaylistStore`).
 */
export interface LayerPlaylist {
  clips: PlaylistClip[]
  loop: boolean
}

/**
 * Sottoinsieme persistibile (entra nello snapshot del progetto).
 *
 * Il modo della transizione resta **globale**: non è la sequenza, è come si passa da un clip al
 * successivo — una preferenza di stile impostata una volta. È anche la durata che `sync.ts` usa
 * per la dissolvenza degli invii manuali all'Output, che non appartiene a nessun layer.
 */
export interface PlaylistsData {
  byLayer: Record<string, LayerPlaylist>
  transitionMode: TransitionMode
  transitionDuration: number
}

/** Forma legacy: una playlist sola per tutto il progetto (progetti salvati prima del per-layer). */
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

function cloneLayerPlaylist(p: LayerPlaylist): LayerPlaylist {
  return { clips: p.clips.map(cloneClip), loop: p.loop }
}

const clampDuration = (d: number) =>
  Math.min(MAX_CLIP_DURATION, Math.max(MIN_CLIP_DURATION, d))

const emptyPlaylist = (): LayerPlaylist => ({ clips: [], loop: true })

interface PlaylistState {
  playlists: Record<string, LayerPlaylist>
  transitionMode: TransitionMode
  transitionDuration: number

  /** Riproduzione in corso, per layer (il motore vive in `use-effect-playlist`). */
  playing: Record<string, boolean>
  /** Indice del clip corrente, per layer. */
  currentIndex: Record<string, number>
  /** Avanzamento 0..1 dentro il clip corrente, per layer (solo per il playhead UI). */
  clipProgress: Record<string, number>
  /** Clip con l'editor aperto. null = nessuno. Uno solo alla volta, quindi resta globale. */
  editingClipId: string | null

  addClipFromShader: (layerId: string, shader: ParsedShader) => string
  addClip: (layerId: string, partial: Omit<PlaylistClip, 'id'>) => string
  removeClip: (layerId: string, id: string) => void
  duplicateClip: (layerId: string, id: string) => void
  updateClip: (layerId: string, id: string, patch: Partial<Omit<PlaylistClip, 'id'>>) => void
  reorderClips: (layerId: string, from: number, to: number) => void

  setPlaying: (layerId: string, playing: boolean) => void
  setCurrentIndex: (layerId: string, index: number) => void
  setClipProgress: (layerId: string, progress: number) => void
  setLoop: (layerId: string, loop: boolean) => void
  setTransitionMode: (mode: TransitionMode) => void
  setTransitionDuration: (seconds: number) => void
  setEditingClip: (id: string | null) => void

  /** Sostituisce i dati persistibili (usato da persistence al load del progetto). */
  setPlaylistsData: (data: PlaylistsData | undefined) => void
}

const DEFAULT_TRANSITION_MODE: TransitionMode = 'smooth'
const DEFAULT_TRANSITION_DURATION = 1

export const usePlaylistStore = create<PlaylistState>((set, get) => {
  const patch = (layerId: string, p: Partial<LayerPlaylist>) =>
    set((s) => ({
      playlists: { ...s.playlists, [layerId]: { ...(s.playlists[layerId] ?? emptyPlaylist()), ...p } },
    }))

  const clipsOf = (layerId: string) => get().playlists[layerId]?.clips ?? []

  return {
    playlists: {},
    transitionMode: DEFAULT_TRANSITION_MODE,
    transitionDuration: DEFAULT_TRANSITION_DURATION,
    playing: {},
    currentIndex: {},
    clipProgress: {},
    editingClipId: null,

    addClipFromShader: (layerId, shader) =>
      get().addClip(layerId, {
        name: shader.name,
        shaderName: shader.name,
        params: defaultParamsFor(shader),
        colors: defaultColorsFor(shader),
        size: DEFAULT_SIZE,
        palette: createDefaultPalette(),
        duration: DEFAULT_CLIP_DURATION,
      }),

    addClip: (layerId, partial) => {
      const id = crypto.randomUUID()
      patch(layerId, { clips: [...clipsOf(layerId), { ...cloneClip({ ...partial, id }), id }] })
      return id
    },

    removeClip: (layerId, id) =>
      set((s) => {
        const previous = s.playlists[layerId]?.clips ?? []
        const index = previous.findIndex((c) => c.id === id)
        const clips = previous.filter((c) => c.id !== id)
        let currentIndex = s.currentIndex[layerId] ?? 0
        if (index !== -1 && index < currentIndex) currentIndex -= 1
        currentIndex = Math.min(currentIndex, Math.max(clips.length - 1, 0))
        return {
          playlists: { ...s.playlists, [layerId]: { ...(s.playlists[layerId] ?? emptyPlaylist()), clips } },
          currentIndex: { ...s.currentIndex, [layerId]: currentIndex },
          playing: clips.length === 0 ? { ...s.playing, [layerId]: false } : s.playing,
          editingClipId: s.editingClipId === id ? null : s.editingClipId,
        }
      }),

    duplicateClip: (layerId, id) => {
      const clips = [...clipsOf(layerId)]
      const index = clips.findIndex((c) => c.id === id)
      if (index === -1) return
      clips.splice(index + 1, 0, { ...cloneClip(clips[index]), id: crypto.randomUUID() })
      patch(layerId, { clips })
    },

    updateClip: (layerId, id, p) =>
      patch(layerId, {
        clips: clipsOf(layerId).map((c) =>
          c.id === id ? { ...c, ...p, duration: clampDuration(p.duration ?? c.duration) } : c,
        ),
      }),

    reorderClips: (layerId, from, to) =>
      set((s) => {
        const previous = s.playlists[layerId]?.clips ?? []
        if (from === to || from < 0 || from >= previous.length) return s
        const clips = [...previous]
        const [moved] = clips.splice(from, 1)
        clips.splice(Math.min(to, clips.length), 0, moved)
        // il clip corrente resta lo stesso oggetto: segui il suo nuovo indice
        const currentId = previous[s.currentIndex[layerId] ?? 0]?.id
        const currentIndex = Math.max(clips.findIndex((c) => c.id === currentId), 0)
        return {
          playlists: { ...s.playlists, [layerId]: { ...(s.playlists[layerId] ?? emptyPlaylist()), clips } },
          currentIndex: { ...s.currentIndex, [layerId]: currentIndex },
        }
      }),

    setPlaying: (layerId, playing) => set((s) => ({ playing: { ...s.playing, [layerId]: playing } })),
    setCurrentIndex: (layerId, index) =>
      set((s) => ({
        currentIndex: { ...s.currentIndex, [layerId]: index },
        clipProgress: { ...s.clipProgress, [layerId]: 0 },
      })),
    setClipProgress: (layerId, progress) =>
      set((s) => ({ clipProgress: { ...s.clipProgress, [layerId]: progress } })),
    setLoop: (layerId, loop) => patch(layerId, { loop }),

    setTransitionMode: (transitionMode) => set({ transitionMode }),
    setTransitionDuration: (transitionDuration) =>
      set({ transitionDuration: Math.min(10, Math.max(0.1, transitionDuration)) }),
    setEditingClip: (editingClipId) => set({ editingClipId }),

    setPlaylistsData: (data) =>
      set({
        playlists: Object.fromEntries(
          Object.entries(data?.byLayer ?? {}).map(([id, p]) => [id, cloneLayerPlaylist(p)]),
        ),
        transitionMode: data?.transitionMode ?? DEFAULT_TRANSITION_MODE,
        transitionDuration: data?.transitionDuration ?? DEFAULT_TRANSITION_DURATION,
        playing: {},
        currentIndex: {},
        clipProgress: {},
        editingClipId: null,
      }),
  }
})

/** Estrae il sottoinsieme persistibile (per lo snapshot del progetto). */
export function playlistsSnapshot(): PlaylistsData {
  const { playlists, transitionMode, transitionDuration } = usePlaylistStore.getState()
  return {
    byLayer: Object.fromEntries(Object.entries(playlists).map(([id, p]) => [id, cloneLayerPlaylist(p)])),
    transitionMode,
    transitionDuration,
  }
}

/**
 * Converte una playlist salvata prima del per-layer, assegnandola al layer che era attivo: era
 * l'unico su cui poteva davvero girare, quindi è lì che l'utente si aspetta di ritrovarla.
 */
export function migrateLegacyPlaylist(legacy: PlaylistData, layerId: string): PlaylistsData {
  return {
    byLayer: { [layerId]: { clips: legacy.clips.map(cloneClip), loop: legacy.loop } },
    transitionMode: legacy.transitionMode,
    transitionDuration: legacy.transitionDuration,
  }
}
