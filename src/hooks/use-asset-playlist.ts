import { useEffect } from 'react'
import { useAssetPlaylistStore, activeItems } from '@/store/assetPlaylistStore'
import { useLayersStore } from '@/store/layersStore'
import { assetUrl } from '@/lib/assetFolder'
import { nextAssetIndex } from '@/lib/assetRotation'
import { applyAssetTick } from '@/lib/sync'

/** Stato di una rotazione in corso: una per layer, indipendente dalle altre. */
interface RotationState {
  stepStart: number
  /** Un caricamento è in volo: senza, un file lento farebbe partire una richiesta per frame. */
  loading: boolean
  /** true prima della prima clip: si mostra subito, senza aspettare l'intervallo. */
  fresh: boolean
  /**
   * Ultimo indice mandato in onda da qui. Se nello store ne compare un altro vuol dire che
   * qualcuno è saltato a una clip a mano dalla barra: il conto riparte da quel momento, invece di
   * cambiare subito dopo perché il tempo era già quasi scaduto.
   */
  lastApplied: number
}

/**
 * Motore della playlist di asset: ogni `intervalSec` secondi porta nel layer il media successivo
 * della cartella collegata.
 *
 * È **per-layer** e gira su tutti i layer in play contemporaneamente, con un solo
 * requestAnimationFrame — stessa forma di `usePaletteLoop`, non della playlist effetti, che è un
 * singleton che agisce sul layer *attivo* (qui la rotazione non deve seguire la selezione).
 *
 * Va montato nella pagina, non nella barra: la barra ha due tab, e passando su "Effetti" il
 * componente della tab Assets si smonta — la rotazione si fermerebbe a metà set.
 */
export function useAssetPlaylist() {
  const playing = useAssetPlaylistStore((s) => s.playing)
  // chiave stabile: l'oggetto cambia identità a ogni set dello store, la stringa no
  const playingKey = Object.entries(playing)
    .filter(([, on]) => on)
    .map(([id]) => id)
    .sort()
    .join(',')

  useEffect(() => {
    const ids = playingKey ? playingKey.split(',') : []
    if (ids.length === 0) return

    const now0 = performance.now()
    const states = new Map<string, RotationState>(
      ids.map((id) => {
        const current = useAssetPlaylistStore.getState().index[id] ?? -1
        // se una clip è già a schermo (ripresa dalla pausa, o scelta a mano) resta il suo tempo
        // pieno: solo una playlist mai partita mostra subito qualcosa
        return [id, { stepStart: now0, loading: false, fresh: current < 0, lastApplied: current }]
      }),
    )

    let raf = 0

    const advance = async (layerId: string, state: RotationState) => {
      const store = useAssetPlaylistStore.getState()
      const data = store.playlists[layerId]
      const items = activeItems(data)
      // il layer è sparito, la cartella è stata scollegata o tutte le clip sono escluse
      if (!data?.dir || items.length === 0 || !useLayersStore.getState().layers.some((l) => l.id === layerId)) {
        store.setPlaying(layerId, false)
        return
      }

      const current = store.index[layerId] ?? -1
      const next = nextAssetIndex(current, items.length, data.shuffle, data.loop)
      if (next < 0) {
        store.setPlaying(layerId, false) // fine sequenza con loop spento
        return
      }

      state.loading = true
      const media = await assetUrl(data.dir, items[next], layerId)
      state.loading = false
      if (!media) {
        // file sparito dal disco o permesso revocato: fermarsi è più onesto che saltare a vuoto
        useAssetPlaylistStore.getState().setPlaying(layerId, false)
        return
      }
      applyAssetTick(layerId, media)
      useAssetPlaylistStore.getState().setIndex(layerId, next)
      state.lastApplied = next
      // il conto riparte da quando la clip è davvero a schermo, non da quando è stata chiesta:
      // altrimenti un video lento da aprire si mangerebbe parte del suo tempo di permanenza
      state.stepStart = performance.now()
    }

    const tick = (now: number) => {
      for (const [layerId, state] of states) {
        if (state.loading) continue
        const store = useAssetPlaylistStore.getState()
        // salto a una clip dalla barra: il conto riparte da adesso
        const current = store.index[layerId] ?? -1
        if (current !== state.lastApplied) {
          state.lastApplied = current
          state.stepStart = now
          state.fresh = false
          continue
        }
        const data = store.playlists[layerId]
        // intervallo letto a ogni giro: cambiarlo mentre gira non fa ripartire la rotazione
        const interval = data?.intervalSec ?? 0
        if (state.fresh || (interval > 0 && (now - state.stepStart) / 1000 >= interval)) {
          state.fresh = false
          void advance(layerId, state)
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // solo l'elenco dei layer in play rimonta il motore: intervallo, ordine ed esclusioni si
    // leggono live nel tick
  }, [playingKey])
}
