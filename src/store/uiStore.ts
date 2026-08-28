import { create } from 'zustand'
import type { ShaderCategoryId } from '../lib/shaderCategories'
import { WARP_EDGE_CORNERS, type WarpEdgeId } from '../lib/warp'

/**
 * Sezioni della sidebar SINISTRA: riguardano il look e il progetto, non il singolo layer.
 * Tutto ciò che descrive il layer selezionato (contenuto, maschere, posizione) vive invece
 * nella colonna destra, dove è visibile tutto insieme.
 */
export type Panel = 'shader' | 'palette' | 'projects' | 'output'

/**
 * Blocchi richiudibili delle sidebar: quelli della colonna destra (sotto la lista dei layer, che
 * resta fissa) e i due della sinistra che si comportano allo stesso modo (Controlli globali,
 * Preset salvati) — stessa persistenza, stesso componente `CollapsibleSection`.
 */
export type LayerSection =
  | 'properties'
  | 'asset'
  | 'mask'
  | 'fxControls'
  | 'effectPresets'

const SECTIONS_STORAGE_KEY = 'easyvj-layer-sections'
const DEFAULT_SECTIONS: Record<LayerSection, boolean> = {
  properties: true,
  asset: true,
  mask: true,
  fxControls: true,
  effectPresets: true,
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

const PLAYLIST_VISIBLE_KEY = 'easyvj-playlist-visible'

function loadPlaylistVisible(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(PLAYLIST_VISIBLE_KEY) !== '0'
  } catch {
    return true
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

/**
 * Cosa stanno pilotando le frecce e il drag sul canvas: tutta la proiezione, un singolo angolo,
 * oppure un intero lato (i due angoli che lo delimitano, mossi insieme).
 */
export type MappingSelection =
  | { kind: 'all' }
  | { kind: 'corner'; index: 0 | 1 | 2 | 3 }
  | { kind: 'edge'; edge: WarpEdgeId }

export const SELECT_ALL: MappingSelection = { kind: 'all' }

/** Indici dei corner interessati dalla selezione; null = tutti e quattro. */
export function selectionCornerIndices(selection: MappingSelection): readonly number[] | null {
  if (selection.kind === 'all') return null
  if (selection.kind === 'corner') return [selection.index]
  return WARP_EDGE_CORNERS[selection.edge]
}

export function sameSelection(a: MappingSelection, b: MappingSelection): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === 'corner' && b.kind === 'corner') return a.index === b.index
  if (a.kind === 'edge' && b.kind === 'edge') return a.edge === b.edge
  return true
}

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
  /** Serve al SidebarProvider della colonna destra, che vuole un `onOpenChange` con il valore. */
  setRightSidebarOpen: (open: boolean) => void
  /**
   * Barra playlist in fondo alla Control: nascondendola il canvas si riprende lo spazio.
   * È solo visibilità: la barra resta montata (display:none), così la riproduzione in corso
   * non si interrompe quando la si chiude.
   */
  playlistVisible: boolean
  togglePlaylist: () => void
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
  /** Bersaglio delle frecce da tastiera e della toolbar di mapping (tutto / angolo / lato). */
  mappingSelection: MappingSelection
  setMappingSelection: (selection: MappingSelection) => void
  /**
   * Modalità curvatura: mostra sul canvas gli handle Bézier dei 4 bordi. Sta fuori dalla scena
   * perché è un modo di lavorare, non una proprietà del mapping: l'Output non ne sa nulla e la
   * curvatura impostata resta applicata anche a modalità spenta.
   */
  warpMode: boolean
  toggleWarpMode: () => void
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
   * Layer su cui gira il loop delle palette casuali: il motore (`use-palette-loop`) ne rigenera
   * la palette a intervalli regolari, dissolvendo da una all'altra.
   *
   * È un elenco di id e non un booleano globale perché il loop appartiene al singolo layer:
   * quando era globale il motore scriveva sempre sul layer *attivo*, così passando a un altro
   * layer il loop lo seguiva e gli ricoloriva la palette senza che fosse stato chiesto.
   *
   * Vive qui e non nel progetto perché è uno stato di esecuzione, come il play della playlist:
   * riaprendo l'app si riparte da fermi. L'intervallo invece è una preferenza (condivisa da
   * tutti i layer) e sopravvive alla sessione.
   */
  paletteLoopLayerIds: string[]
  togglePaletteLoopFor: (layerId: string) => void
  /**
   * Spegne il loop di un layer senza invertirlo. Serve a chi disattiva la palette: lasciandolo
   * acceso continuerebbe a generare colori, e al primo tick la palette si riaccenderebbe da sé
   * (il loop la riabilita quando scrive). Idempotente: su un layer senza loop non fa nulla.
   */
  stopPaletteLoopFor: (layerId: string) => void
  /** Toglie dal loop i layer che non esistono più (eliminati o sostituiti dal caricamento). */
  prunePaletteLoopLayers: (existingIds: string[]) => void
  /**
   * Intervallo del loop per layer, in secondi: ogni layer va al suo tempo, così si possono
   * tenere un fondale che cambia lentamente e un elemento che pulsa veloce.
   *
   * La voce viene materializzata quando si accende il loop su un layer, copiandoci il default:
   * senza questo, i layer sprovvisti di voce propria condividerebbero il default e cambiare il
   * tempo a uno lo cambierebbe anche agli altri.
   */
  paletteLoopIntervals: Record<string, number>
  setPaletteLoopIntervalFor: (layerId: string, seconds: number) => void
  /** Tempo di partenza per i loop accesi da qui in avanti: è l'ultimo impostato, e si ricorda. */
  paletteLoopInterval: number
  /**
   * Famiglia di effetti selezionata nella libreria ('all' = nessun filtro).
   *
   * Sta qui e non dentro il picker perché non governa solo quali voci si vedono: anche le frecce
   * ◀ ▶ e le scorciatoie ⌥A/⌥S scorrono dentro la famiglia filtrata, e quei comandi vivono
   * altrove. Con un filtro attivo, un'unica lista è "dove ci si trova".
   */
  shaderCategory: ShaderCategoryId | 'all'
  setShaderCategory: (category: ShaderCategoryId | 'all') => void
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
  setRightSidebarOpen: (rightSidebarOpen) => set({ rightSidebarOpen }),
  playlistVisible: loadPlaylistVisible(),
  togglePlaylist: () =>
    set((s) => {
      const playlistVisible = !s.playlistVisible
      try {
        window.localStorage.setItem(PLAYLIST_VISIBLE_KEY, playlistVisible ? '1' : '0')
      } catch {
        // storage pieno o disabilitato: lo stato resta valido per la sessione corrente
      }
      return { playlistVisible }
    }),
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
  mappingSelection: SELECT_ALL,
  setMappingSelection: (mappingSelection) => set({ mappingSelection }),
  warpMode: false,
  toggleWarpMode: () => set((s) => ({ warpMode: !s.warpMode })),
  nudgeStep: 'medium',
  setNudgeStep: (nudgeStep) => set({ nudgeStep }),
  gridVisible: false,
  toggleGrid: () => set((s) => ({ gridVisible: !s.gridVisible })),
  snapEnabled: false,
  toggleSnap: () => set((s) => ({ snapEnabled: !s.snapEnabled })),
  paletteLoopLayerIds: [],
  togglePaletteLoopFor: (layerId) =>
    set((s) => {
      const on = s.paletteLoopLayerIds.includes(layerId)
      return {
        paletteLoopLayerIds: on
          ? s.paletteLoopLayerIds.filter((id) => id !== layerId)
          : [...s.paletteLoopLayerIds, layerId],
        // accendendolo il layer prende il tempo di partenza come valore PROPRIO, che da qui in
        // poi si cambia solo da lui; spegnendolo lo si conserva, così riaccendendolo lo ritrova
        paletteLoopIntervals:
          on || s.paletteLoopIntervals[layerId] != null
            ? s.paletteLoopIntervals
            : { ...s.paletteLoopIntervals, [layerId]: s.paletteLoopInterval },
      }
    }),
  stopPaletteLoopFor: (layerId) =>
    set((s) =>
      s.paletteLoopLayerIds.includes(layerId)
        ? { paletteLoopLayerIds: s.paletteLoopLayerIds.filter((id) => id !== layerId) }
        : s,
    ),
  prunePaletteLoopLayers: (existingIds) =>
    set((s) => {
      const paletteLoopLayerIds = s.paletteLoopLayerIds.filter((id) => existingIds.includes(id))
      const keptIntervals = Object.entries(s.paletteLoopIntervals).filter(([id]) =>
        existingIds.includes(id),
      )
      const intervalsChanged = keptIntervals.length !== Object.keys(s.paletteLoopIntervals).length
      const layersChanged = paletteLoopLayerIds.length !== s.paletteLoopLayerIds.length
      // stesso contenuto = stesso stato: evita un aggiornamento inutile a ogni cambio di scena
      if (!layersChanged && !intervalsChanged) return s
      return {
        paletteLoopLayerIds,
        paletteLoopIntervals: Object.fromEntries(keptIntervals),
      }
    }),
  paletteLoopIntervals: {},
  setPaletteLoopIntervalFor: (layerId, seconds) => {
    if (!Number.isFinite(seconds)) return
    const value = clamp(seconds, MIN_PALETTE_LOOP_INTERVAL, MAX_PALETTE_LOOP_INTERVAL)
    try {
      // ricordato come tempo di partenza dei prossimi loop, non come tempo di tutti
      window.localStorage.setItem(PALETTE_LOOP_STORAGE_KEY, String(value))
    } catch {
      // storage pieno o disabilitato: lo stato resta valido per la sessione corrente
    }
    set((s) => ({
      paletteLoopIntervals: { ...s.paletteLoopIntervals, [layerId]: value },
      paletteLoopInterval: value,
    }))
  },
  paletteLoopInterval: loadPaletteLoopInterval(),
  shaderCategory: 'all',
  setShaderCategory: (shaderCategory) => set({ shaderCategory }),
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
