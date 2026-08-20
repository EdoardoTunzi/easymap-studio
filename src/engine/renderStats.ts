/**
 * Numeri reali del rendering della finestra corrente, per il pannello diagnostico dell'Output.
 *
 * Esiste perché "sembra a bassa qualità" ha troppe cause per andare a tentativi: qui si legge
 * *quanti pixel* sta davvero disegnando la GPU, a che frequenza, e se la finestra sta usando tutto
 * lo schermo. Con questi tre numeri si distingue in due secondi una finestra non a schermo intero
 * da una GPU in affanno da un supersampling che non è mai stato attivato.
 *
 * Non è uno store Zustand: viene aggiornato dentro il loop di rendering, e far ripartire il
 * reconciler di React sessanta volte al secondo per scriverci un numero sarebbe esattamente il
 * genere di costo che questo pannello dovrebbe aiutare a scovare. Chi lo mostra si abbona e
 * ridisegna al proprio ritmo.
 */

export interface RenderStats {
  /** Pixel del canvas realmente inviati allo schermo (drawing buffer). */
  bufferWidth: number
  bufferHeight: number
  /** Pixel disegnati dagli shader prima della riduzione finale (buffer interno). */
  renderWidth: number
  renderHeight: number
  /** devicePixelRatio effettivo del canvas. */
  dpr: number
  /** Fattore chiesto nel pannello. */
  superSample: number
  /**
   * Fattore realmente applicato: più basso di quello chiesto quando il buffer sfonda il lato
   * massimo delle texture o il tetto di memoria video. Se i due numeri differiscono il pannello
   * lo dice — credere di proiettare a 4× mentre si è a 2.1× è peggio che saperlo.
   */
  superSampleEffective: number
  /** Buffer interno a mezza precisione float attivo. */
  hdr: boolean
  fps: number
  /** La finestra occupa tutto lo schermo (fullscreen vero o finestra a tutto schermo). */
  fullscreen: boolean
  /** Risoluzione dello schermo su cui sta la finestra, in pixel fisici. */
  screenWidth: number
  screenHeight: number
}

const EMPTY: RenderStats = {
  bufferWidth: 0,
  bufferHeight: 0,
  renderWidth: 0,
  renderHeight: 0,
  dpr: 1,
  superSample: 1,
  superSampleEffective: 1,
  hdr: false,
  fps: 0,
  fullscreen: false,
  screenWidth: 0,
  screenHeight: 0,
}

let current: RenderStats = EMPTY
const listeners = new Set<(stats: RenderStats) => void>()

export function getRenderStats(): RenderStats {
  return current
}

export function publishRenderStats(stats: RenderStats) {
  current = stats
  for (const listener of listeners) listener(stats)
}

export function subscribeRenderStats(listener: (stats: RenderStats) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
