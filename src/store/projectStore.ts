// Tipi e helper geometrici condivisi dalla scena. Lo stato vero (media, corner, transform,
// ecc.) vive ora dentro i singoli layer in `layersStore.ts`: qui restano solo i tipi puri e
// le funzioni di fit, usati sia dai layer sia dai componenti di posizionamento.

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

export function rectCorners(halfWidth: number, halfHeight: number): Corners {
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

export const DEFAULT_CORNERS: Corners = rectCorners(FILL_RATIO, FILL_RATIO)

/**
 * Transform applicato all'intero mesh di un layer (group), sopra il corner-pin.
 * zoom = scala uniforme; offsetX/Y = pan in coordinate mondo. Serve al controller "Move"
 * per centrare/ridimensionare velocemente la proiezione senza toccare i singoli angoli.
 */
export interface Transform {
  zoom: number
  offsetX: number
  offsetY: number
}

export const DEFAULT_TRANSFORM: Transform = { zoom: 1, offsetX: 0, offsetY: 0 }
