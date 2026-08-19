import { useEffect } from 'react'
import { useLayersStore } from '@/store/layersStore'
import { OSCILLOSCOPE_PRESETS, OSCILLOSCOPE_SHADER } from '@/lib/oscilloscopePresets'

/** True su macOS: serve solo a mostrare ⌥ invece di Alt nei tooltip. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent)

/** Etichetta del modificatore usata nei tooltip delle scorciatoie effetto. */
export const ALT_LABEL = IS_MAC ? '⌥' : 'Alt+'

/**
 * Scorciatoie per cambiare effetto senza aprire la select: ⌥A precedente, ⌥S successivo.
 * In più ⌥1…⌥6 applicano le forme rapide, ma **solo** quando il layer attivo ha
 * l'oscilloscopio: sono parametri di quell'effetto, e su ogni altro sarebbero tasti muti.
 *
 * Si confronta `e.code` e non `e.key` perché su macOS Option cambia il carattere prodotto
 * (⌥A → "å", ⌥S → "ß"), mentre il codice del tasto fisico è stabile su ogni layout.
 * Le frecce restano libere per il nudge del corner-pin (vedi MappingControls).
 */
export function useEffectHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return

      // forme rapide dell'oscilloscopio: ⌥1…⌥N
      const digit = e.code.startsWith('Digit') ? Number(e.code.slice(5)) : NaN
      if (digit >= 1 && digit <= OSCILLOSCOPE_PRESETS.length) {
        const state = useLayersStore.getState()
        const active = state.layers.find((l) => l.id === state.activeLayerId)
        if (active?.shaderName !== OSCILLOSCOPE_SHADER) return
        const target = e.target as HTMLElement | null
        const tag = target?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return
        e.preventDefault()
        state.setActiveParams(OSCILLOSCOPE_PRESETS[digit - 1].params)
        return
      }

      if (e.code !== 'KeyA' && e.code !== 'KeyS') return
      // niente auto-repeat: tenendo premuto si salterebbero decine di effetti, ognuno con la
      // sua ricompilazione dello shader
      if (e.repeat) return
      // solo i campi di testo sono esclusi (lì ⌥S scrive un carattere): a differenza del nudge,
      // queste combo non servono a nessun altro controllo, slider compresi
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      e.preventDefault()
      useLayersStore.getState().cycleActiveShader(e.code === 'KeyS' ? 1 : -1)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
