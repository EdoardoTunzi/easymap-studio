import { useEffect } from 'react'
import { useOutputStore } from '@/store/outputStore'

/**
 * Barra spaziatrice = "Esegui in output": manda alla finestra Output le modifiche in sospeso.
 *
 * Attivo **solo in modalità Live**, e solo se c'è qualcosa da inviare (`dirty`), esattamente come
 * il pulsante nella toolbar. Fuori da Live l'Output segue già ogni modifica, quindi non c'è nulla
 * da comandare e lo Spazio resta al pan della vista (Spazio+drag, `useViewportPanZoom`).
 *
 * In Live si prende la precedenza sul comportamento nativo del tasto (`preventDefault`): senza,
 * premendo Spazio con il focus su un pulsante — cosa normale dopo averlo cliccato — il browser lo
 * ri-attiverebbe insieme all'invio. Durante una performance il tasto deve fare una cosa sola.
 */
export function useOutputHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      // nei campi di testo lo Spazio scrive: nessuna scorciatoia può rubarlo
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return

      const { live, dirty, pushToOutput } = useOutputStore.getState()
      if (!live || !dirty) return

      e.preventDefault()
      pushToOutput()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
