import { create } from 'zustand'

/**
 * Qualità di resa dell'immagine proiettata.
 *
 * Non è roba di progetto ma di *macchina*: dipende da quanta GPU c'è e da che proiettore si sta
 * pilotando, quindi vive in localStorage e non nei file salvati — caricando il progetto di un
 * altro PC non ci si porta dietro un supersampling che quella scheda non regge.
 *
 * Viaggia verso l'Output su un messaggio dedicato (vedi `sync.ts`), e **sempre**, modalità Live
 * compresa: non descrive la scena, descrive come va disegnata. Congelarla in Live vorrebbe dire
 * non poter alzare la qualità durante il set.
 */

const STORAGE_KEY = 'easyvj-render-settings'

/** Fattori di supersampling proposti. Il costo in fill rate è il quadrato del fattore. */
export const SUPER_SAMPLE_STEPS = [
  { value: 1, label: '1×', hint: 'Nessun supersampling: la GPU disegna esattamente i pixel del proiettore.' },
  { value: 1.25, label: '1.25×', hint: 'Costo +56%. Ammorbidisce le scalettature più evidenti.' },
  { value: 1.5, label: '1.5×', hint: 'Costo +125%. Il miglior compromesso su macchine normali.' },
  { value: 2, label: '2×', hint: 'Costo +300%. Bordi puliti come su un monitor 4K, se la GPU regge.' },
] as const

export interface RenderSettings {
  /** Moltiplicatore di risoluzione interna: si disegna più grande e si riduce in uscita (SSAA). */
  superSample: number
  /** Buffer interno a mezza precisione float: niente clipping a 1.0 nei blend Add/Screen. */
  hdr: boolean
  /**
   * Rientro morbido delle alte luci (0 = taglio netto a 1.0). Sostituisce il `clamp` brutale con
   * una curva: i colori che sfondano restano colori invece di appiattirsi su bianco.
   */
  rolloff: number
  /** Dithering finale: rompe il banding dei gradienti sugli 8 bit del proiettore. */
  dither: boolean
  /** Grana finissima (0 = spenta): rende gli shader generativi più "video" e maschera il banding. */
  grain: number
  /** Pannello diagnostico sulla finestra Output (risoluzione reale, fps, supersampling). */
  stats: boolean
  /** Cartello di prova a tutto schermo: righe da un pixel, rampa, barre sature, gradini. */
  qualityCard: boolean
}

export const DEFAULT_RENDER: RenderSettings = {
  superSample: 1,
  hdr: true,
  rolloff: 0.35,
  dither: true,
  grain: 0,
  stats: false,
  qualityCard: false,
}

export const MAX_GRAIN = 0.12

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Normalizza qualunque cosa arrivi da storage o dall'altra finestra: valori fuori scala fanno danni. */
export function sanitizeRender(raw: Partial<RenderSettings> | null | undefined): RenderSettings {
  if (!raw) return { ...DEFAULT_RENDER }
  const superSample = Number(raw.superSample)
  return {
    superSample: SUPER_SAMPLE_STEPS.some((s) => s.value === superSample)
      ? superSample
      : DEFAULT_RENDER.superSample,
    hdr: raw.hdr ?? DEFAULT_RENDER.hdr,
    rolloff: Number.isFinite(raw.rolloff) ? clamp(Number(raw.rolloff), 0, 1) : DEFAULT_RENDER.rolloff,
    dither: raw.dither ?? DEFAULT_RENDER.dither,
    grain: Number.isFinite(raw.grain) ? clamp(Number(raw.grain), 0, MAX_GRAIN) : DEFAULT_RENDER.grain,
    stats: raw.stats ?? DEFAULT_RENDER.stats,
    qualityCard: raw.qualityCard ?? DEFAULT_RENDER.qualityCard,
  }
}

function load(): RenderSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_RENDER }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return sanitizeRender(raw ? JSON.parse(raw) : null)
  } catch {
    return { ...DEFAULT_RENDER }
  }
}

function save(settings: RenderSettings) {
  try {
    // il cartello di prova non si ricorda mai acceso: è uno strumento di taratura, ritrovarselo
    // a tutto schermo riaprendo l'app cinque minuti prima di un set sarebbe solo un danno
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...settings, qualityCard: false }))
  } catch {
    // storage pieno o disabilitato: le impostazioni restano valide per la sessione
  }
}

interface RenderState extends RenderSettings {
  set: (patch: Partial<RenderSettings>) => void
  /** Applica quello che arriva dall'altra finestra senza riscrivere lo storage (non è una scelta locale). */
  applyRemote: (settings: RenderSettings) => void
  reset: () => void
}

export const useRenderStore = create<RenderState>((set, get) => ({
  ...load(),
  set: (patch) => {
    const next = sanitizeRender({ ...get(), ...patch })
    save(next)
    set(next)
  },
  applyRemote: (settings) => set(sanitizeRender(settings)),
  reset: () => {
    save(DEFAULT_RENDER)
    set({ ...DEFAULT_RENDER })
  },
}))

/** Snapshot serializzabile, per il BroadcastChannel. */
export function renderSettingsOf(state: RenderSettings): RenderSettings {
  return {
    superSample: state.superSample,
    hdr: state.hdr,
    rolloff: state.rolloff,
    dither: state.dither,
    grain: state.grain,
    stats: state.stats,
    qualityCard: state.qualityCard,
  }
}
