import { create } from 'zustand'
import {
  type MediaAsset,
  type Corner,
  type Corners,
  type Transform,
  DEFAULT_CORNERS,
  DEFAULT_TRANSFORM,
} from './projectStore'
import { DEFAULT_SIZE, DEFAULT_SHADER_NAME } from './effectsStore'
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

/** Modalità di fusione del layer con quelli sottostanti. */
export type BlendMode = 'normal' | 'add' | 'screen' | 'multiply'

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
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
  /** Parametri live per shader: nome shader -> nome uniform -> valore. */
  params: Record<string, Record<string, number>>
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
}

function cloneCorners(corners: Corners): Corners {
  return corners.map((c) => ({ ...c })) as Corners
}

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) }
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
    params: {},
    palette: createDefaultPalette(),
    masks: [],
    maskImage: null,
    corners: cloneCorners(DEFAULT_CORNERS),
    transform: { ...DEFAULT_TRANSFORM },
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
  /** Incrementato per richiedere un ri-adattamento dei corner del layer attivo (vedi AutoFit). */
  fitRequestId: number

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
  setActiveSize: (size: number) => void
  setActiveParam: (uniformName: string, value: number) => void
  setActiveCorner: (index: 0 | 1 | 2 | 3, corner: Corner) => void
  setActiveCorners: (corners: Corners) => void
  moveActiveCorners: (dx: number, dy: number) => void
  setActiveTransform: (transform: Partial<Transform>) => void
  resetActiveTransform: () => void

  // palette del layer attivo
  setPaletteEnabled: (enabled: boolean) => void
  setPaletteAmount: (amount: number) => void
  setPaletteCount: (count: number) => void
  setPaletteColor: (index: number, rgb: RGB) => void
  applyPalettePreset: (name: string) => void

  // maschere del layer attivo
  addMask: (type: MaskShape) => void
  removeMask: (maskId: string) => void
  updateMask: (maskId: string, patch: Partial<Mask>) => void
  selectMask: (maskId: string | null) => void
  setMaskImage: (media: MediaAsset | null) => void

  /** Copia l'effetto del layer attivo (shader + parametri + size + palette) su TUTTI i layer. */
  applyEffectToAll: () => void

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

  /** Applica una patch alla palette del layer attivo. */
  const patchActivePalette = (patch: (p: Palette) => Partial<Palette>) =>
    patchActive((l) => ({ palette: { ...l.palette, ...patch(l.palette) } }))

  return {
    layers: [initialLayer],
    activeLayerId: initialLayer.id,
    activeMaskId: null,
    fitRequestId: 0,

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
      set((state) => ({
        layers: [...state.layers, layer],
        activeLayerId: layer.id,
      }))
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
        return { layers, activeLayerId }
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
          palette: clonePalette(src.palette),
          masks: src.masks.map((m) => ({ ...m, id: crypto.randomUUID() })),
          maskImage: src.maskImage ? { ...src.maskImage } : null,
          corners: cloneCorners(src.corners),
          transform: { ...src.transform },
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
    setActiveShader: (shaderName) => patchActive(() => ({ shaderName })),
    setActiveSize: (size) => patchActive(() => ({ size })),

    setActiveParam: (uniformName, value) =>
      patchActive((l) => ({
        params: {
          ...l.params,
          [l.shaderName]: { ...l.params[l.shaderName], [uniformName]: value },
        },
      })),

    setActiveCorner: (index, corner) =>
      patchActive((l) => {
        const corners = cloneCorners(l.corners)
        corners[index] = corner
        return { corners }
      }),

    setActiveCorners: (corners) => patchActive(() => ({ corners })),

    moveActiveCorners: (dx, dy) =>
      patchActive((l) => ({
        corners: l.corners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Corners,
      })),

    setActiveTransform: (transform) =>
      patchActive((l) => ({ transform: { ...l.transform, ...transform } })),

    resetActiveTransform: () => patchActive(() => ({ transform: { ...DEFAULT_TRANSFORM } })),

    setPaletteEnabled: (enabled) => patchActivePalette(() => ({ enabled })),
    setPaletteAmount: (amount) => patchActivePalette(() => ({ amount })),
    setPaletteCount: (count) =>
      patchActivePalette(() => ({ count: Math.max(2, Math.min(PALETTE_STOPS, count)) })),
    setPaletteColor: (index, rgb) =>
      patchActivePalette((p) => {
        const colors = p.colors.map((c) => [...c] as RGB)
        colors[index] = rgb
        return { colors, activePreset: CUSTOM_PRESET }
      }),
    applyPalettePreset: (name) =>
      patchActivePalette(() => ({
        colors: clonePresetColors(name),
        activePreset: name,
        enabled: true,
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

    applyEffectToAll: () =>
      set((state) => {
        const active = state.layers.find((l) => l.id === state.activeLayerId)
        if (!active) return state
        return {
          layers: state.layers.map((l) => ({
            ...l,
            shaderName: active.shaderName,
            size: active.size,
            params: {
              ...l.params,
              [active.shaderName]: { ...active.params[active.shaderName] },
            },
            palette: clonePalette(active.palette),
          })),
        }
      }),

    requestFit: () => set((state) => ({ fitRequestId: state.fitRequestId + 1 })),

    setScene: (layers, activeLayerId) =>
      set({
        layers: layers.length > 0 ? layers : [createLayer({ name: 'Layer 1' })],
        activeLayerId:
          layers.find((l) => l.id === activeLayerId)?.id ?? layers[0]?.id ?? '',
      }),
  }
})
