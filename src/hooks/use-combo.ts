import { useEffect } from 'react'
import { comboCues, useComboStore } from '@/store/comboStore'
import { useLayersStore } from '@/store/layersStore'
import { usePlaylistStore } from '@/store/playlistStore'
import { useUiStore } from '@/store/uiStore'
import { airScene } from '@/lib/sync'

/** rAF della dissolvenza in corso: una scena, un fade, tutti i layer insieme. */
let fadeRaf = 0

function animateTransition(seconds: number) {
  cancelAnimationFrame(fadeRaf)
  const start = performance.now()
  const step = (now: number) => {
    const p = (now - start) / 1000 / Math.max(seconds, 0.01)
    useLayersStore.getState().setTransitionProgress(Math.min(p, 1))
    if (p < 1) fadeRaf = requestAnimationFrame(step)
  }
  fadeRaf = requestAnimationFrame(step)
}

/**
 * Ferma tutto ciò che riscriverebbe sopra la scena appena lanciata.
 *
 * Tutte le playlist di effetti, non solo quelle dei layer con la cella piena: la colonna spegne
 * anche gli altri, e una playlist su un layer fuori scena continuerebbe a riaccendergli l'effetto
 * sotto un layer invisibile e a risvegliare l'autosave. Il loop palette scrive i colori a ~30 Hz:
 * senza spegnerlo quelli della cella durerebbero un frame. Le playlist di asset restano: sono
 * contenuto, ortogonale al look.
 */
function stopConflicts() {
  const pl = usePlaylistStore.getState()
  for (const [layerId, on] of Object.entries(pl.playing)) if (on) pl.setPlaying(layerId, false)
  useUiStore.getState().prunePaletteLoopLayers([])
}

/** Manda in onda una colonna adesso: click sulla colonna, o passo della sequenza automatica. */
export function launchCombo(comboId: string) {
  const combo = useComboStore.getState().combos.find((c) => c.id === comboId)
  if (!combo) return
  stopConflicts()
  const { transitionMode, transitionDuration } = usePlaylistStore.getState()
  const smooth = transitionMode === 'smooth'
  // in onda anche in Live: una colonna lanciata è la scena che cambia, non una modifica in
  // preparazione. L'Output riceve la scena d'arrivo e la dissolvenza la anima da sé
  airScene(() => useLayersStore.getState().applyScene(comboCues(combo), smooth), smooth ? transitionDuration : 0)
  useComboStore.getState().setCurrentCombo(comboId)
  if (smooth) animateTransition(transitionDuration)
}

/**
 * Sequenza automatica delle combo (solo finestra Control). Un rAF come gli altri motori; va
 * montato nella pagina, non nella barra, che si smonta al cambio tab.
 */
export function useCombo() {
  const playing = useComboStore((s) => s.playing)

  useEffect(() => {
    if (!playing) return
    const s0 = useComboStore.getState()
    // il Play riparte dalla colonna corrente, mandandola in onda subito
    const start = s0.combos.find((c) => c.id === s0.currentComboId) ?? s0.combos[0]
    if (!start) {
      s0.setPlaying(false)
      return
    }
    launchCombo(start.id)

    let raf = 0
    let last = performance.now()
    let elapsed = 0
    const tick = (now: number) => {
      elapsed += (now - last) / 1000
      last = now
      const s = useComboStore.getState()
      const index = s.combos.findIndex((c) => c.id === s.currentComboId)
      const current = s.combos[index]
      // colonna cancellata mentre girava
      if (!current) {
        s.setPlaying(false)
        return
      }
      if (elapsed >= current.duration) {
        const next = index + 1
        if (next >= s.combos.length && !s.loop) {
          s.setProgress(1)
          s.setPlaying(false)
          return
        }
        elapsed = 0
        launchCombo(s.combos[next % s.combos.length].id)
      }
      s.setProgress(Math.min(elapsed / current.duration, 1))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      cancelAnimationFrame(fadeRaf)
      // chiude di colpo i crossfade rimasti a metà
      useLayersStore.getState().setTransitionProgress(1)
    }
  }, [playing])

  // reciproco dell'esclusività: Play su una playlist per-layer ferma la sequenza delle combo.
  // Chiave vuota = è stato `stopConflicts` a scrivere, non l'utente.
  useEffect(() => {
    let last = ''
    return usePlaylistStore.subscribe((s) => {
      const key = Object.keys(s.playing).filter((id) => s.playing[id]).sort().join(',')
      if (key === last) return
      last = key
      if (key !== '') useComboStore.getState().setPlaying(false)
    })
  }, [])
}
