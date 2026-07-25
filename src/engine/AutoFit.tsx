import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { computeContainCorners } from '../store/projectStore'
import { useLayersStore } from '../store/layersStore'

/**
 * Esegue il "contain fit" dei corner del LAYER ATTIVO quando viene richiesto esplicitamente via
 * requestFit() (nuovo upload, pulsante reset). Non reagisce ai cambi di media di per sé, così un
 * progetto ripristinato da IndexedDB mantiene i corner salvati. Va montato solo nella finestra di
 * Controllo: l'Output specchia i corner ricevuti via BroadcastChannel, mai ricalcolati.
 */
export function AutoFit() {
  const fitRequestId = useLayersStore((s) => s.fitRequestId)
  const setActiveCorners = useLayersStore((s) => s.setActiveCorners)
  const size = useThree((s) => s.size)

  // inizializzato al valore corrente: nessun fit al mount, solo su richieste successive
  const lastFitRequestId = useRef(fitRequestId)

  useEffect(() => {
    if (fitRequestId === lastFitRequestId.current) return
    lastFitRequestId.current = fitRequestId

    const media = useLayersStore.getState().getActiveLayer()?.media
    const mediaAspect = media ? media.width / media.height : 1
    // stesso frustum di ResponsiveCamera: half-height 1, half-width pari all'aspect del canvas
    const canvasAspect = size.width / size.height
    setActiveCorners(computeContainCorners(mediaAspect, canvasAspect, 1))
  }, [fitRequestId, size, setActiveCorners])

  return null
}
