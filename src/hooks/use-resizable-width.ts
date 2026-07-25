import { useCallback, useEffect, useRef, useState } from 'react'

interface UseResizableWidthOptions {
  defaultWidth: number
  min: number
  max: number
  storageKey: string
}

/** Larghezza trascinabile persistita in localStorage. Non usa lo stato di collapse di shadcn Sidebar
 *  (che è on/off), qui gestiamo un valore continuo in pixel per il drag handle. */
export function useResizableWidth({ defaultWidth, min, max, storageKey }: UseResizableWidthOptions) {
  const [width, setWidth] = useState(() => {
    if (typeof window === 'undefined') return defaultWidth
    const stored = Number(window.localStorage.getItem(storageKey))
    return Number.isFinite(stored) && stored > 0 ? Math.min(max, Math.max(min, stored)) : defaultWidth
  })

  const widthRef = useRef(width)
  useEffect(() => {
    widthRef.current = width
  }, [width])

  const startResize = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = widthRef.current
      // aggiornata in modo sincrono a ogni move: non dipende dal ciclo di render/effect di
      // React, quindi il valore scritto su pointerup è sempre quello davvero finale
      let latestWidth = startWidth

      const onMove = (e: PointerEvent) => {
        const next = Math.min(max, Math.max(min, startWidth + (e.clientX - startX)))
        latestWidth = next
        setWidth(next)
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.localStorage.setItem(storageKey, String(latestWidth))
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [min, max, storageKey],
  )

  return { width, startResize }
}
