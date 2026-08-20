// Geometria del mapping: omografia del corner-pin e curvatura dei 4 bordi (patch di Coons).
//
// Perché serve un'omografia. La mesh del layer nasce da un quadrato unitario che va portato sui 4
// corner. Interpolando le uv linearmente sui due triangoli del quad, la texture si spezza lungo la
// diagonale appena i corner non formano un parallelogramma — cioè in qualunque keystone. Qui si
// calcola la trasformazione proiettiva esatta quadrato→quad e, per ogni vertice, il fattore `k`
// (1/W) con cui il fragment shader ricostruisce la uv corretta (`vUvW.xy / vUvW.z`).
//
// Perché una patch di Coons. La curvatura dei bordi è definita come 4 Bézier cubiche nello spazio
// unitario, non in coordinate mondo: così resta indipendente da posizione, rotazione e scala del
// quad (che vivono nei corner) e sopravvive a qualunque spostamento del mapping. Con gli handle a
// zero la patch degenera esattamente nell'identità, quindi "nessun warp" = comportamento identico
// a prima, senza casi speciali.
//
// Spazio unitario: (0,0) = BL, (1,0) = BR, (0,1) = TL, (1,1) = TR — cioè le uv di PlaneGeometry.

import type { Corner, Corners } from '../store/projectStore'

export type WarpEdgeId = 'top' | 'right' | 'bottom' | 'left'

/** Scostamento di un punto di controllo Bézier dalla sua posizione "a bordo dritto", in spazio unitario. */
export interface WarpHandle {
  x: number
  y: number
}

/** I 2 punti di controllo di un bordo, in ordine di percorrenza del bordo (t = 1/3 e t = 2/3). */
export type WarpEdgeHandles = [WarpHandle, WarpHandle]

/** Curvatura dei 4 bordi del quad. Assente/azzerata = quad dritto. */
export interface Warp {
  top: WarpEdgeHandles
  right: WarpEdgeHandles
  bottom: WarpEdgeHandles
  left: WarpEdgeHandles
}

export const WARP_EDGES: WarpEdgeId[] = ['top', 'right', 'bottom', 'left']

export const WARP_EDGE_LABELS: Record<WarpEdgeId, string> = {
  top: 'Bordo alto',
  right: 'Bordo destro',
  bottom: 'Bordo basso',
  left: 'Bordo sinistro',
}

/**
 * Indici dei corner (nell'ordine TL, TR, BL, BR) che delimitano ciascun bordo. Servono alla
 * selezione del lato sul canvas: cliccare fra due pin li muove insieme.
 */
export const WARP_EDGE_CORNERS: Record<WarpEdgeId, [0 | 1 | 2 | 3, 0 | 1 | 2 | 3]> = {
  top: [0, 1],
  right: [1, 3],
  bottom: [2, 3],
  left: [0, 2],
}

/** Suddivisione della mesh quando il warp è attivo: senza curvatura resta a 1 quad (costo zero). */
export const WARP_SUBDIVISIONS = 24

/**
 * Limite dello scostamento di un handle, in spazio unitario. Oltre mezzo lato la patch di Coons
 * si ripiega su sé stessa e il mapping diventa illeggibile.
 */
export const WARP_HANDLE_LIMIT = 0.5

export function createWarp(): Warp {
  const zero = (): WarpEdgeHandles => [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ]
  return { top: zero(), right: zero(), bottom: zero(), left: zero() }
}

export const DEFAULT_WARP: Warp = createWarp()

export function cloneWarp(warp: Warp): Warp {
  return {
    top: [{ ...warp.top[0] }, { ...warp.top[1] }],
    right: [{ ...warp.right[0] }, { ...warp.right[1] }],
    bottom: [{ ...warp.bottom[0] }, { ...warp.bottom[1] }],
    left: [{ ...warp.left[0] }, { ...warp.left[1] }],
  }
}

/** Vero se almeno un handle è spostato: decide se suddividere la mesh e se disegnare i bordi curvi. */
export function isWarpActive(warp: Warp | null | undefined): boolean {
  if (!warp) return false
  for (const edge of WARP_EDGES) {
    for (const h of warp[edge]) {
      if (Math.abs(h.x) > 1e-6 || Math.abs(h.y) > 1e-6) return true
    }
  }
  return false
}

/** Estremi di un bordo in spazio unitario, nel verso di percorrenza (u o v crescente). */
const EDGE_ENDS: Record<WarpEdgeId, [Corner, Corner]> = {
  bottom: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
  ],
  top: [
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
  left: [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
  ],
  right: [
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
}

/**
 * I 4 punti di controllo della Bézier cubica di un bordo, in spazio unitario.
 * A handle nulli i due punti interni cadono a 1/3 e 2/3 del segmento: la cubica è la retta.
 */
export function edgeControlPoints(edge: WarpEdgeId, warp: Warp | null | undefined): [Corner, Corner, Corner, Corner] {
  const [p0, p3] = EDGE_ENDS[edge]
  const handles = warp?.[edge]
  const at = (t: number, h: WarpHandle | undefined): Corner => ({
    x: p0.x + (p3.x - p0.x) * t + (h?.x ?? 0),
    y: p0.y + (p3.y - p0.y) * t + (h?.y ?? 0),
  })
  return [p0, at(1 / 3, handles?.[0]), at(2 / 3, handles?.[1]), p3]
}

/** Posizione "a riposo" di un handle (bordo dritto): base da cui si misura lo scostamento. */
export function edgeHandleBase(edge: WarpEdgeId, index: 0 | 1): Corner {
  const [p0, p3] = EDGE_ENDS[edge]
  const t = index === 0 ? 1 / 3 : 2 / 3
  return { x: p0.x + (p3.x - p0.x) * t, y: p0.y + (p3.y - p0.y) * t }
}

function bezier(cp: [Corner, Corner, Corner, Corner], t: number): Corner {
  const mt = 1 - t
  const a = mt * mt * mt
  const b = 3 * mt * mt * t
  const c = 3 * mt * t * t
  const d = t * t * t
  return {
    x: a * cp[0].x + b * cp[1].x + c * cp[2].x + d * cp[3].x,
    y: a * cp[0].y + b * cp[1].y + c * cp[2].y + d * cp[3].y,
  }
}

/** I 4 bordi già valutabili: si precalcolano una volta e si riusano per tutti i vertici della mesh. */
export interface WarpCurves {
  top: [Corner, Corner, Corner, Corner]
  right: [Corner, Corner, Corner, Corner]
  bottom: [Corner, Corner, Corner, Corner]
  left: [Corner, Corner, Corner, Corner]
}

export function warpCurves(warp: Warp | null | undefined): WarpCurves {
  return {
    top: edgeControlPoints('top', warp),
    right: edgeControlPoints('right', warp),
    bottom: edgeControlPoints('bottom', warp),
    left: edgeControlPoints('left', warp),
  }
}

/**
 * Patch di Coons: interpola la superficie fra i 4 bordi curvi, sottraendo la parte bilineare
 * contata due volte. Con bordi dritti restituisce (u, v) esatto.
 */
export function coonsPoint(curves: WarpCurves, u: number, v: number): Corner {
  const b = bezier(curves.bottom, u)
  const t = bezier(curves.top, u)
  const l = bezier(curves.left, v)
  const r = bezier(curves.right, v)
  // termine bilineare dei 4 angoli (0,0) (1,0) (0,1) (1,1): si riduce a (u, v)
  return {
    x: (1 - v) * b.x + v * t.x + (1 - u) * l.x + u * r.x - u,
    y: (1 - v) * b.y + v * t.y + (1 - u) * l.y + u * r.y - v,
  }
}

/** Matrice proiettiva 3×3 in ordine di riga: [a b c, d e f, g h i]. */
export type Homography = [number, number, number, number, number, number, number, number, number]

const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1]

/**
 * Omografia che manda il quadrato unitario sui 4 corner (algoritmo di Heckbert).
 * `corners` è nell'ordine TL, TR, BL, BR: quindi (0,0)→BL, (1,0)→BR, (1,1)→TR, (0,1)→TL.
 */
export function cornersHomography(corners: Corners): Homography {
  const [tl, tr, bl, br] = corners
  const x0 = bl.x, y0 = bl.y
  const x1 = br.x, y1 = br.y
  const x2 = tr.x, y2 = tr.y
  const x3 = tl.x, y3 = tl.y

  const dx1 = x1 - x2
  const dx2 = x3 - x2
  const dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2
  const dy2 = y3 - y2
  const dy3 = y0 - y1 + y2 - y3

  // parallelogramma: la mappa è affine, niente termini proiettivi (e il denominatore sarebbe 0)
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1]
  }

  const den = dx1 * dy2 - dx2 * dy1
  if (Math.abs(den) < 1e-12) return IDENTITY // quad degenere (lati allineati): nessuna correzione
  const g = (dx3 * dy2 - dx2 * dy3) / den
  const h = (dx1 * dy3 - dx3 * dy1) / den
  return [
    x1 - x0 + g * x1,
    x3 - x0 + h * x3,
    x0,
    y1 - y0 + g * y1,
    y3 - y0 + h * y3,
    y0,
    g,
    h,
    1,
  ]
}

/** Punto unitario → mondo. `k` = 1/W: è il peso con cui il fragment corregge la prospettiva. */
export function applyHomography(m: Homography, u: number, v: number): { x: number; y: number; k: number } {
  const w = m[6] * u + m[7] * v + m[8]
  const safe = Math.abs(w) < 1e-9 ? 1e-9 : w
  return {
    x: (m[0] * u + m[1] * v + m[2]) / safe,
    y: (m[3] * u + m[4] * v + m[5]) / safe,
    k: 1 / safe,
  }
}

/** Inversa (aggiunta trasposta): la scala globale è irrilevante, il punto si dis-omogeneizza comunque. */
export function invertHomography(m: Homography): Homography {
  const [a, b, c, d, e, f, g, h, i] = m
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
  if (Math.abs(det) < 1e-12) return IDENTITY
  return [
    (e * i - f * h) / det,
    (c * h - b * i) / det,
    (b * f - c * e) / det,
    (f * g - d * i) / det,
    (a * i - c * g) / det,
    (c * d - a * f) / det,
    (d * h - e * g) / det,
    (b * g - a * h) / det,
    (a * e - b * d) / det,
  ]
}

/** Mondo → unitario, con l'inversa già calcolata. Serve al trascinamento degli handle. */
export function applyHomographyPoint(m: Homography, x: number, y: number): Corner {
  const w = m[6] * x + m[7] * y + m[8]
  const safe = Math.abs(w) < 1e-9 ? 1e-9 : w
  return { x: (m[0] * x + m[1] * y + m[2]) / safe, y: (m[3] * x + m[4] * y + m[5]) / safe }
}

/** Punto unitario (u, v) → mondo, attraversando prima la curvatura dei bordi e poi l'omografia. */
export function warpPoint(
  curves: WarpCurves,
  m: Homography,
  u: number,
  v: number,
): { x: number; y: number; k: number } {
  const p = coonsPoint(curves, u, v)
  return applyHomography(m, p.x, p.y)
}

function clampHandleValue(value: number): number {
  return Math.min(WARP_HANDLE_LIMIT, Math.max(-WARP_HANDLE_LIMIT, value))
}

export function clampHandle(handle: WarpHandle): WarpHandle {
  return { x: clampHandleValue(handle.x), y: clampHandleValue(handle.y) }
}

function mirrorX(h: WarpHandle): WarpHandle {
  return { x: -h.x, y: h.y }
}

function mirrorY(h: WarpHandle): WarpHandle {
  return { x: h.x, y: -h.y }
}

/**
 * Adegua il warp a una specchiatura del contenuto. `flipCorners` scambia i corner senza spostare
 * il quad, quindi l'omografia si ribalta: senza ribaltare anche il warp, la curvatura dei bordi
 * salterebbe dall'altra parte e la sagoma proiettata cambierebbe forma.
 */
export function flipWarp(warp: Warp, axis: 'horizontal' | 'vertical'): Warp {
  if (axis === 'horizontal') {
    // u → 1-u: i bordi orizzontali si percorrono al contrario, quelli verticali si scambiano
    return {
      top: [mirrorX(warp.top[1]), mirrorX(warp.top[0])],
      bottom: [mirrorX(warp.bottom[1]), mirrorX(warp.bottom[0])],
      left: [mirrorX(warp.right[0]), mirrorX(warp.right[1])],
      right: [mirrorX(warp.left[0]), mirrorX(warp.left[1])],
    }
  }
  // v → 1-v: speculare del caso sopra
  return {
    left: [mirrorY(warp.left[1]), mirrorY(warp.left[0])],
    right: [mirrorY(warp.right[1]), mirrorY(warp.right[0])],
    top: [mirrorY(warp.bottom[0]), mirrorY(warp.bottom[1])],
    bottom: [mirrorY(warp.top[0]), mirrorY(warp.top[1])],
  }
}

/**
 * Perimetro del quad campionato lungo i bordi curvi, in coordinate mondo: è il contorno reale
 * della proiezione, quello che l'overlay deve disegnare al posto del poligono a 4 lati.
 * L'ordine è TL → TR → BR → BL, cioè il giro del perimetro.
 */
export function warpOutline(corners: Corners, warp: Warp | null | undefined, samples = 16): Corner[] {
  const m = cornersHomography(corners)
  const curves = warpCurves(warp)
  const points: Corner[] = []
  const push = (u: number, v: number) => {
    const p = warpPoint(curves, m, u, v)
    points.push({ x: p.x, y: p.y })
  }
  for (let i = 0; i < samples; i++) push(i / samples, 1) // alto: TL → TR
  for (let i = 0; i < samples; i++) push(1, 1 - i / samples) // destro: TR → BR
  for (let i = 0; i < samples; i++) push(1 - i / samples, 0) // basso: BR → BL
  for (let i = 0; i < samples; i++) push(0, i / samples) // sinistro: BL → TL
  return points
}
