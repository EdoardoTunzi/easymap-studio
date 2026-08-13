import { create } from 'zustand'

/** Sezioni selezionabili dalla top toolbar; determinano il contenuto del pannello sinistro. */
export type Panel = 'layers' | 'move' | 'shader' | 'mask' | 'palette' | 'assets' | 'output'

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
  view: ViewTransform
  setViewZoom: (zoom: number) => void
  zoomViewBy: (factor: number) => void
  panView: (dx: number, dy: number) => void
  resetView: () => void
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'layers',
  setActivePanel: (activePanel) => set({ activePanel }),
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
