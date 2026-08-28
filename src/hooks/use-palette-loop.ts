import { useEffect } from 'react'
import { useUiStore } from '@/store/uiStore'
import { useLayersStore } from '@/store/layersStore'
import { PALETTE_STOPS, randomPaletteColors, lerpPaletteColors, type RGB } from '@/store/paletteStore'
import { applyPaletteTick } from '@/lib/sync'

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

/** Stato di un ciclo in corso: uno per layer, indipendente dagli altri. */
interface LoopState {
  from: RGB[]
  to: RGB[]
  stepStart: number
  settled: boolean
  lastApply: number
}

/**
 * Motore del loop delle palette casuali (pulsante "Loop" nella sezione Colori casuali).
 * Ogni `paletteLoopInterval` secondi genera una palette casuale e ci dissolve dentro partendo dai
 * colori correnti, così un intervento manuale (Genera, numero di colori, color picker) non viene
 * mai scavalcato con uno stacco: il fade successivo riparte da quello che c'è sullo schermo.
 *
 * Il loop è **per-layer**: gira su ogni layer elencato in `paletteLoopLayerIds`, ognuno col
 * proprio ciclo indipendente e col proprio intervallo, e scrive solo su quello. Prima era un
 * interruttore globale che agiva sul layer *attivo*, quindi cambiando selezione il loop seguiva
 * e ricoloriva un layer che non doveva averlo.
 *
 * Va montato nella pagina, non nel pannello: la sidebar sinistra smonta i pannelli al cambio tab
 * e il loop si spegnerebbe passando su Palette o Progetti.
 *
 * Le scritture passano da `applyPaletteTick`, che oltre allo store aggiorna l'Output anche in
 * modalità Live: il loop anima una scena già in onda, non è una modifica in preparazione, e
 * congelarlo lasciava il proiettore su un colore fisso mentre l'anteprima ciclava.
 */
export function usePaletteLoop() {
  const loopIds = useUiStore((s) => s.paletteLoopLayerIds)
  // chiave stabile: l'array cambia identità a ogni set dello store, la stringa no
  const loopKey = loopIds.join(',')
  const layerIdsKey = useLayersStore((s) => s.layers.map((l) => l.id).join(','))

  // un layer eliminato non deve restare acceso: al suo posto ne comparirebbe un altro con lo
  // stesso id solo per coincidenza, ma la lista crescerebbe a ogni cambio di scena
  useEffect(() => {
    useUiStore.getState().prunePaletteLoopLayers(layerIdsKey ? layerIdsKey.split(',') : [])
  }, [layerIdsKey])

  useEffect(() => {
    const ids = loopKey ? loopKey.split(',') : []
    if (ids.length === 0) return

    /**
     * Intervallo del layer, letto a ogni giro invece che catturato all'avvio: così cambiare il
     * tempo mentre il loop gira non fa ripartire il ciclo (e non serve rimontare l'effetto).
     * I layer senza voce propria usano il tempo di partenza comune.
     */
    const intervalOf = (layerId: string) => {
      const ui = useUiStore.getState()
      return ui.paletteLoopIntervals[layerId] ?? ui.paletteLoopInterval
    }

    const paletteOf = (layerId: string) =>
      useLayersStore.getState().layers.find((l) => l.id === layerId)?.palette

    const start = performance.now()
    const states = new Map<string, LoopState>(
      ids.map((id) => {
        const palette = paletteOf(id)
        return [
          id,
          {
            from: palette?.colors ?? [],
            to: randomPaletteColors(palette?.count ?? PALETTE_STOPS, palette?.colors, palette?.category),
            stepStart: start,
            settled: false,
            lastApply: 0,
          },
        ]
      }),
    )

    let raf = 0

    const tick = (now: number) => {
      for (const [layerId, state] of states) {
        const palette = paletteOf(layerId)
        if (!palette) continue // layer eliminato mentre il loop girava
        const elapsed = (now - state.stepStart) / 1000
        const interval = intervalOf(layerId)
        // sotto i ~1.2s di intervallo la dissolvenza non farebbe in tempo a chiudersi: si accorcia
        // per lasciare comunque un momento di palette piena prima del cambio successivo
        const fade = Math.min(FADE_SECONDS, interval * 0.8)

        // a dissolvenza conclusa si smette di riscrivere la palette: il rAF resta solo a contare
        // il tempo, senza far ripartire sync e autosave a ogni frame
        if (!state.settled) {
          const t = fade > 0 ? Math.min(elapsed / fade, 1) : 1
          // l'ultimo passo si applica sempre, altrimenti il throttle lascerebbe la palette
          // ferma a un valore intermedio invece che sul colore di arrivo
          if (t >= 1 || now - state.lastApply >= MIN_STEP_MS) {
            applyPaletteTick(layerId, lerpPaletteColors(state.from, state.to, t * t * (3 - 2 * t)))
            state.lastApply = now
          }
          state.settled = t >= 1
        }

        if (elapsed >= interval) {
          state.from = palette.colors ?? state.to
          // si parte dai colori a schermo: il generatore li usa per allontanarsi di tinta
          state.to = randomPaletteColors(palette.count ?? PALETTE_STOPS, state.from, palette.category)
          state.stepStart = now
          state.settled = false
        }
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // solo l'elenco dei layer rimonta il motore: gli intervalli si leggono live nel tick
  }, [loopKey])
}
