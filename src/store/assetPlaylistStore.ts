import { create } from 'zustand'
import type { AssetItem } from '../lib/assetFolder'

/**
 * Playlist di **contenuti** di un layer: una cartella su disco i cui media si alternano nel layer
 * a intervallo regolare. Vive in parallelo alla playlist degli effetti (`playlistStore`), che
 * cambia lo *shader*: qui cambia il *media*, e le due possono girare insieme sullo stesso layer.
 *
 * Store separato e non un campo di `Layer` per due motivi: l'elenco non deve entrare nel payload
 * che `useBroadcastPublisher` spedisce all'Output a ogni modifica (all'Output serve solo il media
 * di turno), e l'handle della cartella non ha senso fuori dalla finestra che ne ha il permesso.
 */

export const MIN_ASSET_INTERVAL = 0.5
export const MAX_ASSET_INTERVAL = 600
export const DEFAULT_ASSET_INTERVAL = 5

/** Sottoinsieme persistibile, per layer (entra nello snapshot del progetto). */
export interface AssetPlaylistData {
  /**
   * Handle della cartella. È structured-clonable, quindi IndexedDB lo salva così com'è e il
   * progetto ricorda la cartella; il **permesso** invece non sopravvive al riavvio e va richiesto
   * di nuovo con un gesto dell'utente (vedi `folderPermission`).
   */
  dir?: FileSystemDirectoryHandle
  dirName: string
  items: AssetItem[]
  /** Ogni quanti secondi cambia asset. */
  intervalSec: number
  shuffle: boolean
  loop: boolean
}

export type AssetPlaylists = Record<string, AssetPlaylistData>

const clampInterval = (s: number) =>
  Math.min(MAX_ASSET_INTERVAL, Math.max(MIN_ASSET_INTERVAL, Number.isFinite(s) ? s : DEFAULT_ASSET_INTERVAL))

function emptyPlaylist(): AssetPlaylistData {
  return { dirName: '', items: [], intervalSec: DEFAULT_ASSET_INTERVAL, shuffle: false, loop: true }
}

function cloneData(data: AssetPlaylistData): AssetPlaylistData {
  return { ...data, items: data.items.map((i) => ({ ...i })) }
}

interface AssetPlaylistState {
  playlists: AssetPlaylists
  /** Runtime, non persistito (come `playing`/`currentIndex` della playlist effetti). */
  playing: Record<string, boolean>
  index: Record<string, number>

  setFolder: (layerId: string, dir: FileSystemDirectoryHandle, items: AssetItem[]) => void
  clearFolder: (layerId: string) => void
  /** Sostituisce l'elenco (rilettura della cartella, riordino, esclusioni). */
  setItems: (layerId: string, items: AssetItem[]) => void
  toggleItem: (layerId: string, name: string) => void
  reorderItems: (layerId: string, from: number, to: number) => void
  setInterval: (layerId: string, seconds: number) => void
  setShuffle: (layerId: string, shuffle: boolean) => void
  setLoop: (layerId: string, loop: boolean) => void
  setPlaying: (layerId: string, playing: boolean) => void
  setIndex: (layerId: string, index: number) => void

  /** Sostituisce i dati persistibili (usato da persistence al load del progetto). */
  setAssetPlaylists: (data: AssetPlaylists | undefined) => void
}

export const useAssetPlaylistStore = create<AssetPlaylistState>((set, get) => {
  const patch = (layerId: string, p: Partial<AssetPlaylistData>) =>
    set((s) => ({
      playlists: { ...s.playlists, [layerId]: { ...(s.playlists[layerId] ?? emptyPlaylist()), ...p } },
    }))

  return {
    playlists: {},
    playing: {},
    index: {},

    setFolder: (layerId, dir, items) => {
      patch(layerId, { dir, dirName: dir.name, items })
      set((s) => ({ index: { ...s.index, [layerId]: -1 } }))
    },

    clearFolder: (layerId) =>
      set((s) => {
        const { [layerId]: _removed, ...playlists } = s.playlists
        return {
          playlists,
          playing: { ...s.playing, [layerId]: false },
          index: { ...s.index, [layerId]: -1 },
        }
      }),

    setItems: (layerId, items) => patch(layerId, { items }),

    toggleItem: (layerId, name) =>
      patch(layerId, {
        items: (get().playlists[layerId]?.items ?? []).map((i) =>
          i.name === name ? { ...i, enabled: !i.enabled } : i,
        ),
      }),

    reorderItems: (layerId, from, to) => {
      const items = [...(get().playlists[layerId]?.items ?? [])]
      if (from === to || from < 0 || from >= items.length) return
      const [moved] = items.splice(from, 1)
      items.splice(Math.min(to, items.length), 0, moved)
      patch(layerId, { items })
    },

    setInterval: (layerId, seconds) => patch(layerId, { intervalSec: clampInterval(seconds) }),
    setShuffle: (layerId, shuffle) => patch(layerId, { shuffle }),
    setLoop: (layerId, loop) => patch(layerId, { loop }),

    setPlaying: (layerId, playing) => set((s) => ({ playing: { ...s.playing, [layerId]: playing } })),
    setIndex: (layerId, index) => set((s) => ({ index: { ...s.index, [layerId]: index } })),

    setAssetPlaylists: (data) =>
      set({
        playlists: Object.fromEntries(Object.entries(data ?? {}).map(([id, d]) => [id, cloneData(d)])),
        // un progetto si riapre sempre fermo: la cartella va prima riautorizzata
        playing: {},
        index: {},
      }),
  }
})

/** Estrae il sottoinsieme persistibile (per lo snapshot del progetto). */
export function assetPlaylistsSnapshot(): AssetPlaylists {
  return Object.fromEntries(
    Object.entries(useAssetPlaylistStore.getState().playlists).map(([id, d]) => [id, cloneData(d)]),
  )
}

/** Gli asset che partecipano davvero alla rotazione (le esclusioni restano in elenco, ma ferme). */
export function activeItems(data: AssetPlaylistData | undefined): AssetItem[] {
  return data?.items.filter((i) => i.enabled) ?? []
}
