import { create } from 'zustand'

/**
 * Sezioni della sidebar SINISTRA: riguardano il look e il progetto, non il singolo layer.
 * Tutto ciò che descrive il layer selezionato (contenuto, maschere, posizione) vive invece
 * nella colonna destra, dove è visibile tutto insieme.
 */
export type Panel = 'shader' | 'palette' | 'projects' | 'output'

/** Blocchi richiudibili della colonna destra, sotto la lista dei layer (che resta fissa). */
export type LayerSection = 'properties' | 'asset' | 'mask' | 'move'

const SECTIONS_STORAGE_KEY = 'easyvj-layer-sections'
const DEFAULT_SECTIONS: Record<LayerSection, boolean> = {
  properties: true,
  asset: true,
  mask: true,
  move: true,
}

function loadSections(): Record<LayerSection, boolean> {
  if (typeof window === 'undefined') return { ...DEFAULT_SECTIONS }
  try {
    const raw = window.localStorage.getItem(SECTIONS_STORAGE_KEY)
    return raw ? { ...DEFAULT_SECTIONS, ...JSON.parse(raw) } : { ...DEFAULT_SECTIONS }
  } catch {
    return { ...DEFAULT_SECTIONS }
  }
}

const PALETTE_LOOP_STORAGE_KEY = 'easyvj-palette-loop-interval'

export const MIN_PALETTE_LOOP_INTERVAL = 0.5
export const MAX_PALETTE_LOOP_INTERVAL = 60
export const DEFAULT_PALETTE_LOOP_INTERVAL = 5

function loadPaletteLoopInterval(): number {
  if (typeof window === 'undefined') return DEFAULT_PALETTE_LOOP_INTERVAL
  const raw = Number(window.localStorage.getItem(PALETTE_LOOP_STORAGE_KEY))
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PALETTE_LOOP_INTERVAL
  return Math.min(MAX_PALETTE_LOOP_INTERVAL, Math.max(MIN_PALETTE_LOOP_INTERVAL, raw))
}

/**
 * Zoom/pan della vista di anteprima nella finestra Control. Puramente visivo: sposta solo il
 * frustum della camera locale a questa finestra, non tocca corners/transform dei layer, quindi
 * non ha alcun effetto sull'Output (che non legge mai questo store).
 */
export interface ViewTransform {
  zoom: number
  panX: number
  panY: number
}

const DEFAULT_VIEW: ViewTransform = { zoom: 1, panX: 0, panY: 0 }
export const MIN_VIEW_ZOOM = 0.2
export const MAX_VIEW_ZOOM = 4

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** Angolo del corner-pin bersaglio delle frecce: indice TL/TR/BL/BR, oppure null = tutti insieme. */
export type CornerSelection = 0 | 1 | 2 | 3 | null

/**
 * Passo di spostamento in unità mondo (il frustum è alto 2 unità): "fine" vale circa un pixel
 * su un'anteprima da 1080px ed è il passo dell'allineamento millimetrico su un oggetto reale.
 */
export const NUDGE_STEPS = [
  { id: 'fine', label: 'Fine', value: 0.002 },
  { id: 'medium', label: 'Medio', value: 0.01 },
  { id: 'coarse', label: 'Grande', value: 0.05 },
] as const

export type NudgeStepId = (typeof NUDGE_STEPS)[number]['id']

/** Numero di celle sull'altezza del frustum: il passo di snap in unità mondo è 2 / divisioni. */
export const GRID_DIVISIONS = 24
export const GRID_STEP = 2 / GRID_DIVISIONS

interface UiState {
  activePanel: Panel
  setActivePanel: (panel: Panel) => void
  /** Colonna destra (ispettore del layer selezionato): apribile/richiudibile come la sidebar sinistra. */
  rightSidebarOpen: boolean
  toggleRightSidebar: () => void
  /** Blocchi aperti nella colonna destra, ricordati tra le sessioni. */
  sectionsOpen: Record<LayerSection, boolean>
  toggleSection: (section: LayerSection) => void
  /**
   * Visibilità degli overlay di mapping (maniglie corner-pin e forme delle maschere) sul canvas
   * di anteprima: nasconderli permette di valutare l'effetto senza la cornice che lo sovrasta.
   * Puramente visivo e locale alla finestra Control: l'Output non li disegna mai.
   */
  overlaysVisible: boolean
  toggleOverlays: () => void
  /** Angolo bersaglio delle frecce da tastiera e della toolbar di mapping. */
  selectedCorner: CornerSelection
  setSelectedCorner: (corner: CornerSelection) => void
  /** Passo corrente dello spostamento fine. */
  nudgeStep: NudgeStepId
  setNudgeStep: (step: NudgeStepId) => void
  /** Griglia di allineamento disegnata sul canvas di anteprima (solo Control). */
  gridVisible: boolean
  toggleGrid: () => void
  /** Aggancio dei corner alla griglia durante il trascinamento. */
  snapEnabled: boolean
  toggleSnap: () => void
  /**
   * Loop delle palette casuali: quando è attivo il motore (`use-palette-loop`) rigenera la
   * palette del layer attivo a intervalli regolari, dissolvendo da una all'altra. Vive qui e non
   * nel progetto perché è uno stato di esecuzione, come il play della playlist: riaprendo l'app
   * si riparte da fermi. L'intervallo invece è una preferenza e sopravvive alla sessione.
   */
  paletteLoop: boolean
  togglePaletteLoop: () => void
  paletteLoopInterval: number
  setPaletteLoopInterval: (seconds: number) => void
  view: ViewTransform
  setViewZoom: (zoom: number) => void
  zoomViewBy: (factor: number) => void
  panView: (dx: number, dy: number) => void
  resetView: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'shader',
  setActivePanel: (activePanel) => set({ activePanel }),
  rightSidebarOpen: true,
  toggleRightSidebar: () => set((s) => ({ rightSidebarOpen: !s.rightSidebarOpen })),
  sectionsOpen: loadSections(),
  toggleSection: (section) =>
    set((s) => {
      const sectionsOpen = { ...s.sectionsOpen, [section]: !s.sectionsOpen[section] }
      try {
        window.localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(sectionsOpen))
      } catch {
        // storage pieno o disabilitato: lo stato resta valido per la sessione corrente
      }
      return { sectionsOpen }
    }),
  overlaysVisible: true,
  toggleOverlays: () => set((s) => ({ overlaysVisible: !s.overlaysVisible })),
  selectedCorner: null,
  setSelectedCorner: (selectedCorner) => set({ selectedCorner }),
  nudgeStep: 'medium',
  setNudgeStep: (nudgeStep) => set({ nudgeStep }),
  gridVisible: false,
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  snapEnabled: false,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  paletteLoop: false,
  togglePaletteLoop: () => set((s) => ({ paletteLoop: !s.paletteLoop })),
  paletteLoopInterval: loadPaletteLoopInterval(),
  setPaletteLoopInterval: (seconds) => {
    if (!Number.isFinite(seconds)) return
    const paletteLoopInterval = clamp(seconds, MIN_PALETTE_LOOP_INTERVAL, MAX_PALETTE_LOOP_INTERVAL)
    try {
      window.localStorage.setItem(PALETTE_LOOP_STORAGE_KEY, String(paletteLoopInterval))
    } catch {
      // storage pieno o disabilitato: lo stato resta valido per la sessione corrente
    }
    set({ paletteLoopInterval })
  },
  view: DEFAULT_VIEW,
  setViewZoom: (zoom) =>
    set((s) => ({ view: { ...s.view, zoom: clamp(zoom, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM) } })),
  zoomViewBy: (factor) =>
    set((s) => ({
      view: { ...s.view, zoom: clamp(s.view.zoom * factor, MIN_VIEW_ZOOM, MAX_VIEW_ZOOM) },
    })),
  panView: (dx, dy) =>
    set((s) => ({ view: { ...s.view, panX: s.view.panX + dx, panY: s.view.panY + dy } })),
  resetView: () => set({ view: DEFAULT_VIEW }),
}))
