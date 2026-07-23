import { create } from 'zustand'

export interface MediaAsset {
  id: string
  name: string
  url: string
  width: number
  height: number
  /** Blob originale, tenuto per la persistenza su IndexedDB (i blob URL non sopravvivono al refresh). */
  blob?: Blob
}

export interface Corner {
  x: number
  y: number
}

/** Ordine: top-left, top-right, bottom-left, bottom-right (combacia con PlaneGeometry). */
export type Corners = [Corner, Corner, Corner, Corner]

export const FILL_RATIO = 0.9

function rectCorners(halfWidth: number, halfHeight: number): Corners {
  return [
    { x: -halfWidth, y: halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
  ]
}

/**
 * "Contain fit": la dimensione più grande possibile che sta interamente dentro il frustum
 * disponibile (per non spingere gli angoli fuori dall'area visibile/trascinabile), mantenendo
 * l'aspect ratio del media. frustumHalfWidth/Height sono le dimensioni della camera ortografica
 * in quel momento (dipendono dall'aspect ratio della finestra).
 */
export function computeContainCorners(
  mediaAspect: number,
  frustumHalfWidth: number,
  frustumHalfHeight: number,
): Corners {
  const availableAspect = frustumHalfWidth / frustumHalfHeight
  let halfWidth: number
  let halfHeight: number
  if (mediaAspect > availableAspect) {
    halfWidth = frustumHalfWidth * FILL_RATIO
    halfHeight = halfWidth / mediaAspect
  } else {
    halfHeight = frustumHalfHeight * FILL_RATIO
    halfWidth = halfHeight * mediaAspect
  }
  return rectCorners(halfWidth, halfHeight)
}

const DEFAULT_CORNERS = rectCorners(FILL_RATIO, FILL_RATIO)

/**
 * Transform globale applicato all'intero mesh (group), sopra il corner-pin.
 * zoom = scala uniforme; offsetX/Y = pan in coordinate mondo. Serve al controller "Move"
 * per centrare/ridimensionare velocemente la proiezione senza toccare i singoli angoli.
 */
export interface Transform {
  zoom: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_TRANSFORM: Transform = { zoom: 1, offsetX: 0, offsetY: 0 }

interface ProjectState {
  media: MediaAsset | null
  corners: Corners
  transform: Transform
  /**
   * Luma key (0 = disattivo): sopra questa soglia di luminosità il pixel dell'immagine
   * è pieno, sotto è trasparente. Serve per gli asset con sfondo NERO opaco senza canale alpha.
   */
  lumaKey: number
  /** Incrementato per richiedere un ri-adattamento dei corner al viewport corrente (vedi AutoFit). */
  fitRequestId: number
  setMedia: (media: MediaAsset | null) => void
  setCorner: (index: 0 | 1 | 2 | 3, corner: Corner) => void
  setCorners: (corners: Corners) => void
  moveCorners: (dx: number, dy: number) => void
  setTransform: (transform: Partial<Transform>) => void
  resetTransform: () => void
  setLumaKey: (lumaKey: number) => void
  requestFit: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  media: null,
  corners: DEFAULT_CORNERS,
  transform: DEFAULT_TRANSFORM,
  lumaKey: 0,
  fitRequestId: 0,
  setMedia: (media) => set({ media }),
  setCorner: (index, corner) =>
    set((state) => {
      const corners = [...state.corners] as Corners
      corners[index] = corner
      return { corners }
    }),
  setCorners: (corners) => set({ corners }),
  moveCorners: (dx, dy) =>
    set((state) => ({
      corners: state.corners.map((c) => ({ x: c.x + dx, y: c.y + dy })) as Corners,
    })),
  setTransform: (transform) =>
    set((state) => ({ transform: { ...state.transform, ...transform } })),
  resetTransform: () => set({ transform: DEFAULT_TRANSFORM }),
  setLumaKey: (lumaKey) => set({ lumaKey }),
  requestFit: () => set((state) => ({ fitRequestId: state.fitRequestId + 1 })),
}))
