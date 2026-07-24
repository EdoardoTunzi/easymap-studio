import { useLayersStore } from '../store/layersStore'
import { useEffectsStore } from '../store/effectsStore'
import { useUiStore } from '../store/uiStore'

// espone gli store in window per l'ispezione da console, solo in dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  Object.assign(window, {
    __easyvj: { useLayersStore, useEffectsStore, useUiStore },
  })
}
