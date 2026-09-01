import { useEffect, useRef } from 'react'
import { usePlaylistStore, type PlaylistClip } from '@/store/playlistStore'
import { useLayersStore, type EffectSnapshot } from '@/store/layersStore'

/** Stato di una sequenza in corso: una per layer, indipendente dalle altre. */
interface PlayState {
  /** Secondi trascorsi dentro il clip corrente. */
  clipElapsed: number
  /** Timestamp d'inizio del crossfade in corso, null se nessuno. */
  transitionStart: number | null
  /** false finché il clip corrente non è stato mandato a schermo la prima volta. */
  started: boolean
}

export function clipToEffect(clip: PlaylistClip): EffectSnapshot {
  return {
    shaderName: clip.shaderName,
    params: { ...clip.params },
    colors: { ...(clip.colors ?? {}) },
    size: clip.size,
    palette: clip.palette,
  }
}

/** Applica il look del clip a un layer preciso, secco o in crossfade. */
export function applyClip(layerId: string, clip: PlaylistClip, smooth: boolean) {
  useLayersStore.getState().applyEffectSnapshot(clipToEffect(clip), smooth, layerId)
}

/**
 * Motore della playlist degli effetti (solo finestra Control): avanza il tempo del clip corrente,
 * al cambio clip applica il look al **suo** layer e anima la dissolvenza.
 *
 * Gira su tutti i layer in riproduzione con un solo requestAnimationFrame, come `usePaletteLoop`
 * e `useAssetPlaylist`. Prima stava dentro `PlaylistBar` ed era un singleton che scriveva sul
 * layer *attivo*, letto a ogni tick: cambiare selezione durante un set spostava la sequenza su un
 * altro layer, riscrivendone l'effetto.
 *
 * Va montato nella pagina: la barra ha due tab e non è il posto dove tenere in vita un set.
 */
export function useEffectPlaylist() {
  const playing = usePlaylistStore((s) => s.playing)
  // chiave stabile: l'oggetto cambia identità a ogni set dello store, la stringa no
  const playingKey = Object.entries(playing)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .sort()
    .join(',')

  /**
   * Gli stati vivono fuori dall'effetto: mettere in play un secondo layer lo rimonta, e ricreare
   * la mappa azzererebbe il conto del layer che stava già suonando.
   */
  const statesRef = useRef(new Map<string, PlayState>())

  useEffect(() => {
    const ids = playingKey ? playingKey.split(',') : []
    const states = statesRef.current
    for (const id of states.keys()) if (!ids.includes(id)) states.delete(id)
    if (ids.length === 0) return
    for (const id of ids) {
      if (!states.has(id)) states.set(id, { clipElapsed: 0, transitionStart: null, started: false })
    }

    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now

      for (const [layerId, state] of states) {
        const store = usePlaylistStore.getState()
        const clips = store.playlists[layerId]?.clips ?? []
        if (clips.length === 0) {
          store.setPlaying(layerId, false)
          continue
        }

        let index = Math.min(store.currentIndex[layerId] ?? 0, clips.length - 1)

        // avvio: il clip corrente va a schermo subito, secco
        if (!state.started) {
          state.started = true
          applyClip(layerId, clips[index], false)
        }

        if (state.transitionStart != null) {
          const p = (now - state.transitionStart) / 1000 / Math.max(store.transitionDuration, 0.01)
          useLayersStore.getState().setTransitionProgress(Math.min(p, 1), layerId)
          if (p >= 1) state.transitionStart = null
        }

        let clip = clips[index]
        state.clipElapsed += dt

        if (state.clipElapsed >= clip.duration) {
          const nextIndex = index + 1
          if (nextIndex >= clips.length && !store.playlists[layerId]?.loop) {
            store.setClipProgress(layerId, 1)
            store.setPlaying(layerId, false)
            continue
          }
          index = nextIndex % clips.length
          clip = clips[index]
          state.clipElapsed = 0
          const smooth = store.transitionMode === 'smooth'
          applyClip(layerId, clip, smooth)
          if (smooth) state.transitionStart = now
          store.setCurrentIndex(layerId, index)
        }

        store.setClipProgress(layerId, Math.min(state.clipElapsed / clip.duration, 1))
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // chiude di colpo i crossfade rimasti a metà
      useLayersStore.getState().setTransitionProgress(1)
    }
  }, [playingKey])
}
