import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { useProjectStore, computeContainCorners } from '../store/projectStore'

/**
 * Esegue il "contain fit" dei corner quando viene richiesto esplicitamente via requestFit()
 * (nuovo upload, pulsante reset). Non reagisce ai cambi di media di per sé, così un progetto
 * ripristinato da IndexedDB mantiene i corner salvati. Va montato solo nella finestra di
 * Controllo: l'Output specchia i corner ricevuti via BroadcastChannel, mai ricalcolati.
 */
export function AutoFit() {
  const fitRequestId = useProjectStore((s) => s.fitRequestId)
  const setCorners = useProjectStore((s) => s.setCorners)
  const size = useThree((s) => s.size)

  // inizializzato al valore corrente: nessun fit al mount, solo su richieste successive
  const lastFitRequestId = useRef(fitRequestId)

  useEffect(() => {
    if (fitRequestId === lastFitRequestId.current) return
    lastFitRequestId.current = fitRequestId

    const media = useProjectStore.getState().media
    const mediaAspect = media ? media.width / media.height : 1
    // stesso frustum di ResponsiveCamera: half-height 1, half-width pari all'aspect del canvas
    const canvasAspect = size.width / size.height
    setCorners(computeContainCorners(mediaAspect, canvasAspect, 1))
  }, [fitRequestId, size, setCorners])

  return null
}
