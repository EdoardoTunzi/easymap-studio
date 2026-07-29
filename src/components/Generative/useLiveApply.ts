import { useEffect } from 'react'
import { useGenerativeStore } from '@/store/generativeStore'
import { useEffectsStore } from '@/store/effectsStore'
import { useLayersStore } from '@/store/layersStore'
import { publishGenerativeShader } from '@/lib/sync'
import type { ParsedShader } from '@/engine/isfParser'

/**
 * Nomi dei visual salvati su IndexedDB, tenuti aggiornati dal pannello: servono a distinguere le
 * voci fantasma create digitando il nome (da rimuovere) dai visual veri (da lasciare in libreria).
 */
let savedNames = new Set<string>()

export function setSavedVisualNames(names: string[]) {
  savedNames = new Set(names)
}

/**
 * Riversa lo shader del draft sul layer attivo: lo registra nella libreria, lo assegna al layer
 * azzerandone i parametri memorizzati (i valori correnti stanno nei `@default` della sorgente) e
 * lo comunica alle finestre Output, che altrimenti non conoscerebbero un visual non ancora salvato.
 */
export function applyDraftToActiveLayer(shader: ParsedShader, source: string) {
  useEffectsStore.getState().registerShaders([shader])
  useLayersStore.getState().adoptShaderDefaults(shader.name)
  publishGenerativeShader(source)
}

/**
 * Uno shader si può togliere dalla libreria solo se non è un visual salvato e nessun layer lo usa:
 * digitando il nome in live se ne crea uno per ogni carattere, e senza questa pulizia il menu
 * Effetto si riempirebbe di nomi parziali.
 */
function isDisposable(name: string) {
  if (savedNames.has(name)) return false
  return !useLayersStore.getState().layers.some((l) => l.shaderName === name)
}

/**
 * In modalità live (default) ogni modifica del draft si riflette immediatamente sul layer attivo,
 * senza premere "Al layer attivo". Non applica al mount: solo quando il draft cambia davvero o
 * quando si riattiva l'interruttore, così aprire il pannello non sovrascrive a sorpresa l'effetto
 * del layer selezionato.
 */
export function useLiveApply() {
  useEffect(() => {
    let prevShader = useGenerativeStore.getState().shader
    let prevLive = useGenerativeStore.getState().liveApply

    return useGenerativeStore.subscribe((state) => {
      const shaderChanged = state.shader !== prevShader
      const justEnabled = state.liveApply && !prevLive
      const previousName = prevShader?.name

      prevShader = state.shader
      prevLive = state.liveApply

      if (!state.liveApply || !state.shader) return
      if (!shaderChanged && !justEnabled) return

      applyDraftToActiveLayer(state.shader, state.source)

      if (previousName && previousName !== state.shader.name && isDisposable(previousName)) {
        useEffectsStore.getState().unregisterShader(previousName)
      }
    })
  }, [])
}
