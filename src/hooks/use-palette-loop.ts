import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'
import { useLayersStore } from '@/store/layersStore'
import { PALETTE_STOPS, randomPaletteColors, lerpPaletteColors } from '@/store/paletteStore'

/** Durata della dissolvenza fra due palette. Con intervalli brevi si accorcia (vedi sotto). */
const FADE_SECONDS = 1

/**
 * Passo minimo fra due scritture della palette durante la dissolvenza (~30 aggiornamenti al
 * secondo). Ogni scrittura nello store fa ri-renderizzare l'interfaccia, pubblica lo stato
 * all'Output e risveglia l'autosave: a 120 fps significava farlo 120 volte al secondo, con
 * scatti visibili sul canvas. A 30 Hz la dissolvenza resta continua all'occhio ma costa un
 * quarto: i colori sono comunque interpolati sul tempo reale, non sul numero di passi.
 */
const MIN_STEP_MS = 33

/**
 * Motore del loop delle palette casuali (pulsante "Loop" nella sezione Colori casuali).
 * Ogni `paletteLoopInterval` secondi genera una palette casuale e ci dissolve dentro partendo dai
 * colori correnti, così un intervento manuale (Genera, numero di colori, color picker) non viene
 * mai scavalcato con uno stacco: il fade successivo riparte da quello che c'è sullo schermo.
 *
 * Va montato nella pagina, non nel pannello: la sidebar sinistra smonta i pannelli al cambio tab
 * e il loop si spegnerebbe passando su Palette o Progetti.
 *
 * Non ha alcun trattamento speciale per la modalità Live: passa da `setPaletteColors` come il
 * pulsante Genera, quindi in Live l'Output resta fermo e i colori lo raggiungono solo con
 * "Esegui in output", esattamente come ogni altra modifica.
 */
export function usePaletteLoop() {
  const enabled = useUiStore((s) => s.paletteLoop)
  const interval = useUiStore((s) => s.paletteLoopInterval)

  useEffect(() => {
    if (!enabled) return

    const { setPaletteColors, getActiveLayer } = useLayersStore.getState()
    // sotto i ~1.2s di intervallo la dissolvenza non farebbe in tempo a chiudersi: si accorcia
    // per lasciare comunque un momento di palette piena prima del cambio successivo
    const fade = Math.min(FADE_SECONDS, interval * 0.8)

    let from = getActiveLayer()?.palette.colors ?? []
    let to = randomPaletteColors(getActiveLayer()?.palette.count ?? PALETTE_STOPS)
    let stepStart = performance.now()
    let settled = false
    let lastApply = 0
    let raf = 0

    const tick = (now: number) => {
      const elapsed = (now - stepStart) / 1000

      // a dissolvenza conclusa si smette di riscrivere la palette: il rAF resta solo a contare
      // il tempo, senza far ripartire sync e autosave a ogni frame
      if (!settled) {
        const t = fade > 0 ? Math.min(elapsed / fade, 1) : 1
        // l'ultimo passo si applica sempre, altrimenti il throttle lascerebbe la palette
        // ferma a un valore intermedio invece che sul colore di arrivo
        if (t >= 1 || now - lastApply >= MIN_STEP_MS) {
          setPaletteColors(lerpPaletteColors(from, to, t * t * (3 - 2 * t)))
          lastApply = now
        }
        settled = t >= 1
      }

      if (elapsed >= interval) {
        from = getActiveLayer()?.palette.colors ?? to
        to = randomPaletteColors(getActiveLayer()?.palette.count ?? PALETTE_STOPS)
        stepStart = now
        settled = false
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [enabled, interval])
}
