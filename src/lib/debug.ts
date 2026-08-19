import { useLayersStore } from '../store/layersStore'
import { useEffectsStore } from '../store/effectsStore'
import { useUiStore } from '../store/uiStore'
import { getAudioLevel, getAudioState } from '../engine/audioInput'

// espone gli store in window per l'ispezione da console, solo in dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  Object.assign(window, {
    __easyvj: {
      useLayersStore,
      useEffectsStore,
      useUiStore,
      // l'ingresso audio non è uno store: senza questo, verificare se sta entrando segnale
      // richiederebbe di leggerlo dall'interfaccia
      audio: { state: getAudioState, level: getAudioLevel },
    },
  })
}
