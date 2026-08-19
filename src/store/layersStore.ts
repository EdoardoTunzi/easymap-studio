import { create } from 'zustand'
import {
  type MediaAsset,
  type Corner,
  type Corners,
  type Transform,
  DEFAULT_CORNERS,
  DEFAULT_TRANSFORM,
} from './projectStore'
import {
  DEFAULT_SIZE,
  DEFAULT_SHADER_NAME,
  NONE_SHADER_NAME,
  useEffectsStore,
} from './effectsStore'
import {
  rotateCorners,
  scaleCorners,
  flipCorners,
  straightenCorners,
} from '../lib/mappingGeometry'
import { useUiStore } from './uiStore'
import {
  type Palette,
  type RGB,
  createDefaultPalette,
  clonePresetColors,
  CUSTOM_PRESET,
  PALETTE_STOPS,
} from './paletteStore'

/** Forma di una maschera vettoriale. */
export type MaskShape = 'rectangle' | 'ellipse'

/**
 * Maschera di forma per-layer, definita nello spazio dei corner (stesse unità del corner-pin):
 * così segue il warp/transform del layer. Più maschere si sommano (unione): il layer è visibile
 * dove è dentro almeno una forma.
 */
export interface Mask {
  id: string
  type: MaskShape
  /** Centro (spazio corner). */
  cx: number
  cy: number
  /** Semi-dimensioni (spazio corner). */
  hx: number
  hy: number
  /** Rotazione in radianti. */
  rotation: number
  /** Sfumatura del bordo, 0..1 (frazione della semi-dimensione minore). */
  feather: number
  /** Se true, ritaglia FUORI dalla forma invece che dentro. */
  invert: boolean
}

/** Il "look" completo applicabile a un layer (usato da playlist, preset e transizioni). */
export interface EffectSnapshot {
  shaderName: string
  params: Record<string, number>
  /** Valori degli uniform colore (vec3) dello shader. */
  colors: Record<string, RGB>
  size: number
  palette: Palette
}

/**
 * Effetto uscente durante un crossfade: ShaderPlane lo renderizza in dissolvenza sotto quello
 * nuovo. Transiente: viaggia nel sync verso l'Output ma NON viene persistito.
 */
export interface LayerTransition extends EffectSnapshot {
  /** Avanzamento della dissolvenza 0..1 (0 = solo vecchio effetto, 1 = solo nuovo). */
  progress: number
}

/**
 * Controlli globali del layer, validi per QUALSIASI shader: agiscono nel wrapper GLSL, prima
 * (uv) e dopo (colore) `processColor`. Servono a dare profondità di regolazione anche agli
 * effetti che espongono pochi uniform propri.
 */
export interface FxControls {
  /** Moltiplicatore del tempo dell'effetto (1 = velocità originale). */
  speed: number
  /** Rotazione del pattern in radianti. */
  rotation: number
  offsetX: number
  offsetY: number
  /** Segmenti del caleidoscopio; < 2 = disattivato. */
  kaleido: number
  mirrorX: boolean
  mirrorY: boolean
  /** Lato della griglia di quantizzazione; < 1 = disattivato. */
  pixelate: number
  contrast: number
  brightness: number
  saturation: number
  /** Livelli di colore per canale; < 2 = disattivato. */
  posterize: number
  /** Miscela col negativo, 0..1. */
  invert: number
}

export const DEFAULT_FX: FxControls = {
  speed: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  kaleido: 0,
  mirrorX: false,
  mirrorY: false,
  pixelate: 0,
  contrast: 1,
  brightness: 1,
  saturation: 1,
  posterize: 0,
  invert: 0,
}

/**
 * Modalità di fusione del layer con quelli sottostanti.
 *
 * Le prime quattro le calcola il blending hardware; le altre hanno bisogno di leggere il colore
 * sottostante e vengono risolte nello shader (vedi `backdrop.ts`). La differenza è invisibile
 * all'uso, ma le seconde costano una copia dello schermo per layer.
 */
export type BlendMode =
  | 'normal'
  | 'add'
  | 'screen'
  | 'multiply'
  | 'overlay'
  | 'softLight'
  | 'hardLight'
  | 'difference'
  | 'exclusion'
  | 'darken'
  | 'lighten'
  | 'colorBurn'
  | 'colorDodge'

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'softLight', label: 'Soft Light' },
  { value: 'hardLight', label: 'Hard Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'colorBurn', label: 'Color Burn' },
  { value: 'colorDodge', label: 'Color Dodge' },
]

/**
 * Un Layer è un'unità completa e autonoma della scena: contenuto (media) + effetto (shader
 * con i suoi parametri, size e palette) + mapping (corner-pin + transform) + mixing (visibilità,
 * opacità, blend mode). I layer sono impilati: index 0 = sfondo, ultimo = in primo piano.
 */
export interface Layer {
  id: string
  name: string
  visible: boolean
  /** Opacità del layer (0..1). */
  opacity: number
  blendMode: BlendMode
  /** Contenuto: immagine sorgente (in futuro anche gif/video). null = shader puramente generativo. */
  media: MediaAsset | null
  /** Luma key (0 = off): ritaglia le zone scure di un media con sfondo nero opaco. */
  lumaKey: number
  /** Effetto shader applicato sopra il contenuto. */
  shaderName: string
  /** Size globale del pattern dello shader (uniform uScale). */
  size: number
  /**
   * Trattamenti globali dell'effetto (velocità, geometria, colore). Sono proprietà del LAYER
   * come opacità e blend, non parte dell'`EffectSnapshot`: cambiando effetto o clip di playlist
   * restano applicati, così il look del layer non si azzera a ogni transizione.
   */
  fx: FxControls
  /** Parametri live per shader: nome shader -> nome uniform -> valore. */
  params: Record<string, Record<string, number>>
  /** Colori (uniform vec3) per shader: nome shader -> nome uniform -> RGB 0..1. */
  colorParams: Record<string, Record<string, RGB>>
  /** Palette (gradient map) del layer. */
  palette: Palette
  /** Maschere di forma (unione) che limitano dove il layer è visibile. */
  masks: Mask[]
  /** Maschera da immagine (stencil PNG/grayscale). null = non usata. */
  maskImage: MediaAsset | null
  /** Corner-pin in coordinate mondo (TL, TR, BL, BR). */
  corners: Corners
  /** Transform (zoom + pan) applicato sopra il corner-pin. */
  transform: Transform
  /**
   * Mapping bloccato: corner e transform diventano immutabili (drag sul canvas incluso).
   * Allineare una proiezione su una statua è lento e delicato: il lucchetto evita di
   * perdere il lavoro con un click accidentale sul canvas durante il live.
   */
  locked: boolean
  /** Crossfade in corso (effetto uscente): transiente, non persistito. */
  transition: LayerTransition | null
}

function cloneCorners(corners: Corners): Corners {
  return corners.map((c) => ({ ...c })) as Corners
}

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) }
}

/** Copia in `target` l'effetto completo (shader + parametri + colori + size + palette) di `source`. */
function withEffectOf(target: Layer, source: Layer): Layer {
  return {
    ...target,
    shaderName: source.shaderName,
    size: source.size,
    fx: { ...source.fx },
    params: { ...target.params, [source.shaderName]: { ...source.params[source.shaderName] } },
    colorParams: {
      ...target.colorParams,
      [source.shaderName]: { ...(source.colorParams[source.shaderName] ?? {}) },
    },
    palette: clonePalette(source.palette),
  }
}

let layerSeq = 0

/** Crea un nuovo layer con i default (contenuto vuoto, primo shader della libreria). */
export function createLayer(partial?: Partial<Layer>): Layer {
  layerSeq += 1
  return {
    id: crypto.randomUUID(),
    name: partial?.name ?? `Layer ${layerSeq}`,
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    media: null,
    lumaKey: 0,
    shaderName: DEFAULT_SHADER_NAME,
    size: DEFAULT_SIZE,
    fx: { ...DEFAULT_FX },
    params: {},
    colorParams: {},
    palette: createDefaultPalette(),
    masks: [],
    maskImage: null,
    corners: cloneCorners(DEFAULT_CORNERS),
    transform: { ...DEFAULT_TRANSFORM },
    locked: false,
    transition: null,
    ...partial,
  }
}

/** Bounding box dei corner del layer (spazio corner). */
function cornersBounds(corners: Corners) {
  const xs = corners.map((c) => c.x)
  const ys = corners.map((c) => c.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, hw: (maxX - minX) / 2, hh: (maxY - minY) / 2 }
}

/** Maschera di default: centrata sul layer, ~metà della sua estensione. */
function defaultMask(type: MaskShape, corners: Corners): Mask {
  const b = cornersBounds(corners)
  return {
    id: crypto.randomUUID(),
    type,
    cx: b.cx,
    cy: b.cy,
    hx: Math.max(b.hw * 0.5, 0.1),
    hy: Math.max(b.hh * 0.5, 0.1),
    rotation: 0,
    feather: 0.1,
    invert: false,
  }
}

interface LayersState {
  layers: Layer[]
  activeLayerId: string
  /** Maschera selezionata nell'editor (per l'overlay sul canvas). null = nessuna. */
  activeMaskId: string | null
  /**
   * Layer spuntati che ricevono l'effetto del layer attivo: ogni edit di EFFETTO (shader,
   * parametri, size, palette) del layer attivo si propaga a questi. Vuoto = layer indipendenti.
   * La selezione persiste (non si azzera cambiando effetto).
   */
  syncTargetIds: string[]
  /** Incrementato per richiedere un ri-adattamento dei corner del layer attivo (vedi AutoFit). */
  fitRequestId: number
  /**
   * Scena uscente durante il crossfade di un invio all'Output. Vive solo nella finestra Output
   * e solo per la durata della dissolvenza: è una copia congelata dei layer precedenti, che
   * viene renderizzata sotto quella nuova con opacità decrescente. null = nessun crossfade.
   * A differenza di `Layer.transition` (che sfuma il solo effetto) copre l'intera scena, quindi
   * anche media, mapping, maschere e layer aggiunti o rimossi.
   */
  outgoingLayers: Layer[] | null
  /** Avanzamento del crossfade di scena: 0 = solo scena uscente, 1 = solo scena nuova. */
  sceneFade: number
  /** Applica la nuova scena conservando quella corrente come uscente, e riparte da fade 0. */
  beginSceneCrossfade: (layers: Layer[], activeLayerId: string) => void
  /** Avanza il crossfade di scena; a >= 1 lo chiude e libera la scena uscente. */
  setSceneFade: (progress: number) => void
  /**
   * Griglia di calibrazione disegnata sopra il layer attivo, in Control **e in Output**: serve a
   * far coincidere fisicamente i bordi della proiezione con quelli dell'oggetto reale prima di
   * mandare in scena il contenuto. Stato di scena transiente: viaggia nel sync ma non è persistito.
   */
  testPattern: boolean
  setTestPattern: (on: boolean) => void

  getActiveLayer: () => Layer | undefined

  // struttura / selezione
  selectLayer: (id: string) => void
  addLayer: (partial?: Partial<Layer>) => string
  removeLayer: (id: string) => void
  duplicateLayer: (id: string) => void
  reorderLayers: (from: number, to: number) => void
  renameLayer: (id: string, name: string) => void
  setLayerVisible: (id: string, visible: boolean) => void
  setLayerOpacity: (id: string, opacity: number) => void
  setLayerBlendMode: (id: string, mode: BlendMode) => void

  // editing del layer attivo
  setActiveMedia: (media: MediaAsset | null) => void
  setActiveLumaKey: (lumaKey: number) => void
  setActiveShader: (shaderName: string) => void
  /** Passa all'effetto successivo (dir 1) o precedente (dir -1) della libreria, a ciclo. */
  cycleActiveShader: (dir: 1 | -1) => void
  /** Estrae valori casuali per tutti gli uniform float dello shader attivo. */
  randomizeActiveParams: () => void
  setActiveSize: (size: number) => void
  /** Aggiorna i controlli globali dell'effetto sul layer attivo (+ layer sincronizzati). */
  setActiveFx: (patch: Partial<FxControls>) => void
  /** Riporta i controlli globali ai valori neutri. */
  resetActiveFx: () => void
  setActiveParam: (uniformName: string, value: number) => void
  /**
   * Applica più uniform in un colpo solo (preset di forma dell'oscilloscopio). Farlo con N
   * chiamate a `setActiveParam` significherebbe N notifiche dello store, quindi N invii della
   * scena all'Output per un singolo click.
   */
  setActiveParams: (patch: Record<string, number>) => void
  /** Imposta un uniform colore (vec3) dello shader attivo. */
  setActiveColorParam: (uniformName: string, rgb: RGB) => void
  setActiveCorner: (index: 0 | 1 | 2 | 3, corner: Corner) => void
  setActiveCorners: (corners: Corners) => void
  moveActiveCorners: (dx: number, dy: number) => void
  setActiveTransform: (transform: Partial<Transform>) => void
  resetActiveTransform: () => void

  // mapping geometrico del layer attivo (operazioni sui corner, vedi lib/mappingGeometry.ts)
  /** Ruota la proiezione attorno al suo centro (radianti, positivo = antiorario). */
  rotateActiveCorners: (radians: number) => void
  /** Scala la proiezione attorno al suo centro, per asse (1 = invariato). */
  scaleActiveCorners: (sx: number, sy: number) => void
  /** Specchia il contenuto proiettato senza spostare il quad. */
  flipActiveCorners: (axis: 'horizontal' | 'vertical') => void
  /** Riporta i corner a un rettangolo, conservando centro e dimensioni. */
  straightenActiveCorners: () => void
  /**
   * Sposta di (dx, dy) un singolo corner, oppure tutti e quattro se `index` è null.
   * È il gesto dell'allineamento fine da tastiera.
   */
  nudgeActiveCorners: (dx: number, dy: number, index: 0 | 1 | 2 | 3 | null) => void
  /** Blocca/sblocca il mapping di un layer (corner e transform diventano immutabili). */
  setLayerLocked: (id: string, locked: boolean) => void
  toggleActiveLocked: () => void

  // palette del layer attivo
  setPaletteEnabled: (enabled: boolean) => void
  setPaletteAmount: (amount: number) => void
  setPaletteCount: (count: number) => void
  setPaletteColor: (index: number, rgb: RGB) => void
  /**
   * Sostituisce tutti i colori della palette (es. generatore casuale) e la attiva.
   * Con `count` imposta anche quanti stop sono attivi, così generare una palette a N colori
   * non lascia visibili gli stop della palette precedente.
   */
  setPaletteColors: (colors: RGB[], count?: number) => void
  /**
   * Come `setPaletteColors` ma su un layer indicato, che può non essere quello attivo: serve al
   * loop delle palette, che gira per-layer e non deve seguire la selezione. La propagazione ai
   * layer spuntati avviene solo se il layer indicato è quello attivo, come per ogni altro edit.
   */
  setLayerPaletteColors: (layerId: string, colors: RGB[], count?: number) => void
  applyPalettePreset: (name: string) => void

  // maschere del layer attivo
  addMask: (type: MaskShape) => void
  removeMask: (maskId: string) => void
  updateMask: (maskId: string, patch: Partial<Mask>) => void
  selectMask: (maskId: string | null) => void
  setMaskImage: (media: MediaAsset | null) => void

  // playlist / transizioni
  /**
   * Applica un effetto completo al layer attivo (+ layer spuntati in syncTargetIds).
   * Con smooth=true avvia un crossfade: l'effetto precedente resta in `transition` e va
   * animato con setTransitionProgress fino a 1.
   */
  applyEffectSnapshot: (effect: EffectSnapshot, smooth: boolean) => void
  /** Aggiorna l'avanzamento di tutti i crossfade in corso; a >=1 li chiude. */
  setTransitionProgress: (progress: number) => void

  // sincronizzazione effetto (guidata dalle spunte)
  toggleSyncTarget: (layerId: string) => void
  /** Spunta tutti i layer (on) o li rende indipendenti azzerando la selezione (off). */
  setSyncAll: (on: boolean) => void

  requestFit: () => void

  /** Sostituisce l'intera scena (usato da persistence/sync). */
  setScene: (layers: Layer[], activeLayerId: string) => void
}

const initialLayer = createLayer({ name: 'Layer 1' })

export const useLayersStore = create<LayersState>((set, get) => {
  /** Applica una patch al solo layer attivo. */
  const patchActive = (patch: (layer: Layer) => Partial<Layer>) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === state.activeLayerId ? { ...l, ...patch(l) } : l,
      ),
    }))

  /**
   * Come `patchActive`, ma per le modifiche di MAPPING: se il layer è bloccato non fa nulla.
   * Unico punto di applicazione del lucchetto, così ogni via d'ingresso (drag sul canvas,
   * pad direzionale, frecce da tastiera, toolbar) lo rispetta senza doverlo ricontrollare.
   */
  const patchActiveMapping = (patch: (layer: Layer) => Partial<Layer>) =>
    set((state) => ({
      layers: state.layers.map((l) =>
        l.id === state.activeLayerId && !l.locked ? { ...l, ...patch(l) } : l,
      ),
    }))

  /**
   * Applica una patch di EFFETTO al layer attivo e propaga l'effetto completo (shader + params +
   * size + palette) ai layer spuntati (syncTargetIds). Vuoto = nessuna propagazione.
   */
  const editEffect = (patch: (l: Layer) => Partial<Layer>) =>
    set((state) => {
      const active = state.layers.find((l) => l.id === state.activeLayerId)
      if (!active) return state
      const newActive = { ...active, ...patch(active) }
      const targets = new Set(state.syncTargetIds)
      return {
        layers: state.layers.map((l) => {
          if (l.id === state.activeLayerId) return newActive
          if (targets.has(l.id)) return withEffectOf(l, newActive)
          return l
        }),
      }
    })

  return {
    layers: [initialLayer],
    activeLayerId: initialLayer.id,
    activeMaskId: null,
    syncTargetIds: [], // di default i layer sono indipendenti
    fitRequestId: 0,
    outgoingLayers: null,
    sceneFade: 1,
    testPattern: false,

    setTestPattern: (testPattern) => set({ testPattern }),

    getActiveLayer: () => {
      const s = get()
      return s.layers.find((l) => l.id === s.activeLayerId)
    },

    selectLayer: (id) => set({ activeLayerId: id }),

    addLayer: (partial) => {
      const layer = createLayer({
        name: partial?.name ?? `Layer ${get().layers.length + 1}`,
        ...partial,
      })
      // nuovo layer indipendente: non entra nella selezione di sincronizzazione
      set((state) => ({ layers: [...state.layers, layer], activeLayerId: layer.id }))
      return layer.id
    },

    removeLayer: (id) =>
      set((state) => {
        if (state.layers.length <= 1) return state // tieni sempre almeno un layer
        const index = state.layers.findIndex((l) => l.id === id)
        const layers = state.layers.filter((l) => l.id !== id)
        let activeLayerId = state.activeLayerId
        if (activeLayerId === id) {
          const next = layers[Math.min(index, layers.length - 1)]
          activeLayerId = next.id
        }
        return { layers, activeLayerId, syncTargetIds: state.syncTargetIds.filter((x) => x !== id) }
      }),

    duplicateLayer: (id) =>
      set((state) => {
        const index = state.layers.findIndex((l) => l.id === id)
        if (index < 0) return state
        const src = state.layers[index]
        const copy: Layer = {
          ...src,
          id: crypto.randomUUID(),
          name: `${src.name} copy`,
          params: structuredClone(src.params),
          colorParams: structuredClone(src.colorParams),
          palette: clonePalette(src.palette),
          masks: src.masks.map((m) => ({ ...m, id: crypto.randomUUID() })),
          maskImage: src.maskImage ? { ...src.maskImage } : null,
          corners: cloneCorners(src.corners),
          transform: { ...src.transform },
          transition: null,
        }
        const layers = [...state.layers]
        layers.splice(index + 1, 0, copy)
        return { layers, activeLayerId: copy.id }
      }),

    reorderLayers: (from, to) =>
      set((state) => {
        if (from === to || from < 0 || to < 0) return state
        const layers = [...state.layers]
        if (from >= layers.length || to >= layers.length) return state
        const [moved] = layers.splice(from, 1)
        layers.splice(to, 0, moved)
        return { layers }
      }),

    renameLayer: (id, name) =>
      set((state) => ({
        layers: state.layers.map((l) => (l.id === id ? { ...l, name } : l)),
      })),

    setLayerVisible: (id, visible) =>
      set((state) => ({
        layers: state.layers.map((l) => (l.id === id ? { ...l, visible } : l)),
      })),

    setLayerOpacity: (id, opacity) =>
      set((state) => ({
        layers: state.layers.map((l) => (l.id === id ? { ...l, opacity } : l)),
      })),

    setLayerBlendMode: (id, blendMode) =>
      set((state) => ({
        layers: state.layers.map((l) => (l.id === id ? { ...l, blendMode } : l)),
      })),

    setActiveMedia: (media) => patchActive(() => ({ media })),
    setActiveLumaKey: (lumaKey) => patchActive(() => ({ lumaKey })),
    // shader / size / param sono EFFETTO → passano da editEffect (propagazione col link)
    setActiveShader: (shaderName) => editEffect(() => ({ shaderName })),

    // Scorrimento rapido della libreria (frecce del pannello e scorciatoie ⌥A/⌥S). Passa da
    // editEffect come la select, quindi propaga ai layer sincronizzati allo stesso modo.
    cycleActiveShader: (dir) =>
      editEffect((l) => {
        // "Nessun effetto" resta fuori dal giro: è il blackout, non una tappa dello scorrimento
        const all = useEffectsStore
          .getState()
          .shaders.filter((s) => s.name !== NONE_SHADER_NAME)
        // con un filtro di famiglia attivo lo scorrimento resta dentro quella famiglia: le frecce
        // devono muoversi in ciò che si sta guardando, non portare fuori dall'elenco filtrato
        const category = useUiStore.getState().shaderCategory
        const pool = category === 'all' ? all : all.filter((s) => s.category === category)
        // famiglia vuota (non dovrebbe accadere: i pulsanti a zero non si mostrano) → tutta la libreria
        const names = (pool.length > 0 ? pool : all).map((s) => s.name)
        if (names.length === 0) return {}
        const current = names.indexOf(l.shaderName)
        // da "Nessun effetto" (indice -1) si entra dal primo o dall'ultimo, secondo la direzione
        const next =
          current === -1
            ? dir === 1
              ? 0
              : names.length - 1
            : (current + dir + names.length) % names.length
        return { shaderName: names[next] }
      }),

    randomizeActiveParams: () =>
      editEffect((l) => {
        const shader = useEffectsStore.getState().shaders.find((s) => s.name === l.shaderName)
        if (!shader || shader.controls.length === 0) return {}
        const random = Object.fromEntries(
          shader.controls.map((c) => {
            // stesso passo dello slider: evita valori con dieci decimali, illeggibili nel readout
            const step = (c.max - c.min) / 200 || 0.01
            const value = c.min + Math.round((Math.random() * (c.max - c.min)) / step) * step
            return [c.name, value]
          }),
        )
        return { params: { ...l.params, [l.shaderName]: random } }
      }),

    setActiveSize: (size) => editEffect(() => ({ size })),

    setActiveFx: (patch) => editEffect((l) => ({ fx: { ...l.fx, ...patch } })),
    resetActiveFx: () => editEffect(() => ({ fx: { ...DEFAULT_FX } })),

    setActiveParam: (uniformName, value) =>
      editEffect((l) => ({
        params: {
          ...l.params,
          [l.shaderName]: { ...l.params[l.shaderName], [uniformName]: value },
        },
      })),

    setActiveParams: (patch) =>
      editEffect((l) => ({
        params: {
          ...l.params,
          [l.shaderName]: { ...l.params[l.shaderName], ...patch },
        },
      })),

    setActiveColorParam: (uniformName, rgb) =>
      editEffect((l) => ({
        colorParams: {
          ...l.colorParams,
          [l.shaderName]: { ...l.colorParams[l.shaderName], [uniformName]: rgb },
        },
      })),

    setActiveCorner: (index, corner) =>
      patchActiveMapping((l) => {
        const corners = cloneCorners(l.corners)
        corners[index] = corner
        return { corners }
      }),

    setActiveCorners: (corners) => patchActiveMapping(() => ({ corners })),

    moveActiveCorners: (dx, dy) =>
      patchActiveMapping((l) => ({
        corners: l.corners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Corners,
      })),

    setActiveTransform: (transform) =>
      patchActiveMapping((l) => ({ transform: { ...l.transform, ...transform } })),

    resetActiveTransform: () => patchActiveMapping(() => ({ transform: { ...DEFAULT_TRANSFORM } })),

    rotateActiveCorners: (radians) =>
      patchActiveMapping((l) => ({ corners: rotateCorners(l.corners, radians) })),

    scaleActiveCorners: (sx, sy) =>
      patchActiveMapping((l) => ({ corners: scaleCorners(l.corners, sx, sy) })),

    flipActiveCorners: (axis) =>
      patchActiveMapping((l) => ({ corners: flipCorners(l.corners, axis) })),

    straightenActiveCorners: () =>
      patchActiveMapping((l) => ({ corners: straightenCorners(l.corners) })),

    nudgeActiveCorners: (dx, dy, index) =>
      patchActiveMapping((l) => ({
        corners: l.corners.map((c, i) =>
          index === null || i === index ? { x: c.x + dx, y: c.y + dy } : c,
        ) as Corners,
      })),

    setLayerLocked: (id, locked) =>
      set((state) => ({
        layers: state.layers.map((l) => (l.id === id ? { ...l, locked } : l)),
      })),

    toggleActiveLocked: () =>
      set((state) => ({
        layers: state.layers.map((l) =>
          l.id === state.activeLayerId ? { ...l, locked: !l.locked } : l,
        ),
      })),

    // la palette è EFFETTO → editEffect (propagazione col link)
    setPaletteEnabled: (enabled) =>
      editEffect((l) => ({ palette: { ...l.palette, enabled } })),
    setPaletteAmount: (amount) =>
      editEffect((l) => ({ palette: { ...l.palette, amount } })),
    setPaletteCount: (count) =>
      editEffect((l) => ({
        palette: { ...l.palette, count: Math.max(2, Math.min(PALETTE_STOPS, count)) },
      })),
    setPaletteColor: (index, rgb) =>
      editEffect((l) => {
        const colors = l.palette.colors.map((c) => [...c] as RGB)
        colors[index] = rgb
        return { palette: { ...l.palette, colors, activePreset: CUSTOM_PRESET } }
      }),
    setPaletteColors: (colors, count) =>
      editEffect((l) => ({
        palette: {
          ...l.palette,
          colors: colors.map((c) => [...c] as RGB),
          count:
            count == null ? l.palette.count : Math.max(2, Math.min(PALETTE_STOPS, Math.round(count))),
          activePreset: CUSTOM_PRESET,
          enabled: true,
        },
      })),

    setLayerPaletteColors: (layerId, colors, count) =>
      set((state) => {
        const source = state.layers.find((l) => l.id === layerId)
        if (!source) return state
        const updated: Layer = {
          ...source,
          palette: {
            ...source.palette,
            colors: colors.map((c) => [...c] as RGB),
            count:
              count == null
                ? source.palette.count
                : Math.max(2, Math.min(PALETTE_STOPS, Math.round(count))),
            activePreset: CUSTOM_PRESET,
            enabled: true,
          },
        }
        // i layer spuntati seguono solo il layer attivo: un loop che gira su un layer di sfondo
        // non deve trascinarsi dietro la selezione di sincronizzazione
        const targets =
          layerId === state.activeLayerId ? new Set(state.syncTargetIds) : new Set<string>()
        return {
          layers: state.layers.map((l) =>
            l.id === layerId ? updated : targets.has(l.id) ? withEffectOf(l, updated) : l,
          ),
        }
      }),
    applyPalettePreset: (name) =>
      editEffect((l) => ({
        palette: { ...l.palette, colors: clonePresetColors(name), activePreset: name, enabled: true },
      })),

    addMask: (type) => {
      const active = get().layers.find((l) => l.id === get().activeLayerId)
      const mask = defaultMask(type, active?.corners ?? DEFAULT_CORNERS)
      patchActive((l) => ({ masks: [...l.masks, mask] }))
      set({ activeMaskId: mask.id })
    },

    removeMask: (maskId) => {
      patchActive((l) => ({ masks: l.masks.filter((m) => m.id !== maskId) }))
      set((state) => ({ activeMaskId: state.activeMaskId === maskId ? null : state.activeMaskId }))
    },

    updateMask: (maskId, patch) =>
      patchActive((l) => ({
        masks: l.masks.map((m) => (m.id === maskId ? { ...m, ...patch } : m)),
      })),

    selectMask: (maskId) => set({ activeMaskId: maskId }),

    setMaskImage: (media) => patchActive(() => ({ maskImage: media })),

    applyEffectSnapshot: (effect, smooth) =>
      set((state) => {
        const targets = new Set([state.activeLayerId, ...state.syncTargetIds])
        return {
          layers: state.layers.map((l) => {
            if (!targets.has(l.id)) return l
            const transition: LayerTransition | null = smooth
              ? {
                  shaderName: l.shaderName,
                  params: { ...(l.params[l.shaderName] ?? {}) },
                  colors: { ...(l.colorParams[l.shaderName] ?? {}) },
                  size: l.size,
                  palette: clonePalette(l.palette),
                  progress: 0,
                }
              : null
            return {
              ...l,
              shaderName: effect.shaderName,
              size: effect.size,
              params: { ...l.params, [effect.shaderName]: { ...effect.params } },
              colorParams: { ...l.colorParams, [effect.shaderName]: { ...effect.colors } },
              palette: clonePalette(effect.palette),
              transition,
            }
          }),
        }
      }),

    setTransitionProgress: (progress) =>
      set((state) => {
        if (!state.layers.some((l) => l.transition)) return state
        return {
          layers: state.layers.map((l) =>
            l.transition
              ? progress >= 1
                ? { ...l, transition: null }
                : { ...l, transition: { ...l.transition, progress } }
              : l,
          ),
        }
      }),

    toggleSyncTarget: (layerId) =>
      set((state) => {
        const has = state.syncTargetIds.includes(layerId)
        const syncTargetIds = has
          ? state.syncTargetIds.filter((x) => x !== layerId)
          : [...state.syncTargetIds, layerId]
        // spuntando un layer, riceve subito l'effetto corrente del layer attivo
        let layers = state.layers
        if (!has) {
          const active = state.layers.find((l) => l.id === state.activeLayerId)
          if (active && layerId !== active.id) {
            layers = state.layers.map((l) => (l.id === layerId ? withEffectOf(l, active) : l))
          }
        }
        return { syncTargetIds, layers }
      }),

    setSyncAll: (on) =>
      set((state) => {
        if (!on) return { syncTargetIds: [] }
        const active = state.layers.find((l) => l.id === state.activeLayerId)
        const syncTargetIds = state.layers.map((l) => l.id)
        // allinea subito tutti gli altri layer all'effetto del layer attivo
        const layers = active
          ? state.layers.map((l) => (l.id !== active.id ? withEffectOf(l, active) : l))
          : state.layers
        return { syncTargetIds, layers }
      }),

    requestFit: () => set((state) => ({ fitRequestId: state.fitRequestId + 1 })),

    setScene: (layers, activeLayerId) => {
      const next = layers.length > 0 ? layers : [createLayer({ name: 'Layer 1' })]
      set({
        layers: next,
        activeLayerId: next.find((l) => l.id === activeLayerId)?.id ?? next[0]?.id ?? '',
        syncTargetIds: [], // il caricamento riparte con layer indipendenti
        // un cambio scena secco interrompe un eventuale crossfade in corso
        outgoingLayers: null,
        sceneFade: 1,
      })
    },

    beginSceneCrossfade: (layers, activeLayerId) => {
      const next = layers.length > 0 ? layers : [createLayer({ name: 'Layer 1' })]
      set((state) => ({
        // se un crossfade è già in corso la scena uscente resta quella di partenza: ripartire
        // da quella intermedia farebbe "saltare" indietro l'immagine già in dissolvenza
        outgoingLayers: state.outgoingLayers ?? state.layers,
        sceneFade: 0,
        layers: next,
        activeLayerId: next.find((l) => l.id === activeLayerId)?.id ?? next[0]?.id ?? '',
        syncTargetIds: [],
      }))
    },

    setSceneFade: (progress) =>
      set(() =>
        progress >= 1 ? { sceneFade: 1, outgoingLayers: null } : { sceneFade: progress },
      ),
  }
})
