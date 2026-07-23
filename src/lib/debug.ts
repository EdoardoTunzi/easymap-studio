import { useProjectStore } from '../store/projectStore'
import { useEffectsStore } from '../store/effectsStore'

// espone gli store in window per l'ispezione da console, solo in dev
if (import.meta.env.DEV && typeof window !== 'undefined') {
  Object.assign(window, {
    __easyvj: { useProjectStore, useEffectsStore },
  })
}
