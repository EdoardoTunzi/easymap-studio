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

/**
 * Come si deforma la superficie fra i 4 corner.
 * - `bezier`: curvatura dei 4 bordi (patch di Coons). Pochi handle, curve morbide: la modalità
 *   giusta per statue, colonne e archi, dove a piegarsi è il contorno.
 * - `grid`: reticolo di nodi trascinabili (Catmull-Rom). Serve quando la superficie ha
 *   irregolarità *interne* che i soli bordi non descrivono.
 * Sono alternative, non si sommano: i dati dell'altra restano memorizzati, quindi si può
 * tornare indietro senza rifare il lavoro.
 */
export type WarpMode = 'bezier' | 'grid'

/**
 * Reticolo di deformazione. `cols`/`rows` sono le CELLE per asse: i nodi sono (cols+1)×(rows+1).
 * `points` è l'elenco degli scostamenti dalla posizione regolare, riga per riga a partire da
 * v = 0 (basso); indice = row * (cols+1) + col.
 */
export interface WarpGrid {
  cols: number
  rows: number
  points: WarpHandle[]
}

/** Curvatura dei 4 bordi del quad. Assente/azzerata = quad dritto. */
export interface Warp {
  top: WarpEdgeHandles
  right: WarpEdgeHandles
  bottom: WarpEdgeHandles
  left: WarpEdgeHandles
  /** Assente = 'bezier' (i progetti salvati prima della griglia non hanno il campo). */
  mode?: WarpMode
  grid?: WarpGrid
  /**
   * Correzione della distorsione dell'obiettivo, applicata SOPRA la deformazione scelta e in
   * qualunque modalità: negativo = barile (i bordi si gonfiano), positivo = cuscino (i bordi
   * rientrano). I 4 angoli restano fermi per costruzione, quindi il corner-pin non si sposta.
   */
  lens?: number
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
    mode: warp.mode,
    grid: warp.grid
      ? { cols: warp.grid.cols, rows: warp.grid.rows, points: warp.grid.points.map((p) => ({ ...p })) }
      : undefined,
    lens: warp.lens,
  }
}

export function warpMode(warp: Warp | null | undefined): WarpMode {
  return warp?.mode === 'grid' ? 'grid' : 'bezier'
}

/** Vero se almeno un handle di un bordo è spostato. */
export function isBezierActive(warp: Warp | null | undefined): boolean {
  if (!warp) return false
  for (const edge of WARP_EDGES) {
    for (const h of warp[edge]) {
      if (Math.abs(h.x) > 1e-6 || Math.abs(h.y) > 1e-6) return true
    }
  }
  return false
}

/** Vero se almeno un nodo del reticolo è spostato. */
export function isGridActive(grid: WarpGrid | null | undefined): boolean {
  if (!grid) return false
  return grid.points.some((p) => Math.abs(p.x) > 1e-6 || Math.abs(p.y) > 1e-6)
}

/**
 * Vero se la superficie non è un quad piatto: decide se suddividere la mesh e cosa disegnare
 * nell'overlay. Conta solo la modalità ATTIVA (i dati dell'altra restano memorizzati ma inerti),
 * più la correzione dell'obiettivo, che vale in entrambe.
 */
export function isWarpActive(warp: Warp | null | undefined): boolean {
  if (!warp) return false
  if (Math.abs(warp.lens ?? 0) > 1e-6) return true
  return warpMode(warp) === 'grid' ? isGridActive(warp.grid) : isBezierActive(warp)
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

// ---- Reticolo di deformazione (modalità 'grid') ----

/** Celle per asse ammesse: da 2×2 celle (3×3 nodi) a 4×4 celle (5×5 nodi). */
export const GRID_MIN_CELLS = 2
export const GRID_MAX_CELLS = 4
export const GRID_DEFAULT_CELLS = 2

export function createWarpGrid(cols = GRID_DEFAULT_CELLS, rows = GRID_DEFAULT_CELLS): WarpGrid {
  const count = (cols + 1) * (rows + 1)
  return { cols, rows, points: Array.from({ length: count }, () => ({ x: 0, y: 0 })) }
}

export function gridNodeIndex(grid: WarpGrid, col: number, row: number): number {
  return row * (grid.cols + 1) + col
}

/** Posizione regolare del nodo (senza scostamento), in spazio unitario. */
export function gridNodeBase(grid: WarpGrid, col: number, row: number): Corner {
  return { x: col / grid.cols, y: row / grid.rows }
}

/** Posizione corrente del nodo = regolare + scostamento. */
export function gridNodePoint(grid: WarpGrid, col: number, row: number): Corner {
  const base = gridNodeBase(grid, col, row)
  const h = grid.points[gridNodeIndex(grid, col, row)]
  return { x: base.x + (h?.x ?? 0), y: base.y + (h?.y ?? 0) }
}

/** I 4 nodi d'angolo coincidono col corner-pin: non si trascinano da qui, li muovono i suoi handle. */
export function isGridCornerNode(
  grid: Pick<WarpGrid, 'cols' | 'rows'>,
  col: number,
  row: number,
): boolean {
  return (col === 0 || col === grid.cols) && (row === 0 || row === grid.rows)
}

/**
 * Nodo con indici anche fuori dal reticolo. Fuori dai bordi NON si clampa ma si estrapola
 * linearmente: col clamp la tangente di Catmull-Rom al bordo verrebbe dimezzata e la superficie
 * si affloscerebbe lì anche a reticolo non deformato, rompendo l'identità.
 */
function gridNodeExtended(grid: WarpGrid, col: number, row: number): Corner {
  if (col < 0) {
    const a = gridNodeExtended(grid, 0, row)
    const b = gridNodeExtended(grid, 1, row)
    return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
  }
  if (col > grid.cols) {
    const a = gridNodeExtended(grid, grid.cols, row)
    const b = gridNodeExtended(grid, grid.cols - 1, row)
    return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
  }
  if (row < 0) {
    const a = gridNodeExtended(grid, col, 0)
    const b = gridNodeExtended(grid, col, 1)
    return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
  }
  if (row > grid.rows) {
    const a = gridNodeExtended(grid, col, grid.rows)
    const b = gridNodeExtended(grid, col, grid.rows - 1)
    return { x: 2 * a.x - b.x, y: 2 * a.y - b.y }
  }
  return gridNodePoint(grid, col, row)
}

/** Catmull-Rom uniforme: passa esattamente per p1 e p2. */
function catmullRom(p0: Corner, p1: Corner, p2: Corner, p3: Corner, t: number): Corner {
  const t2 = t * t
  const t3 = t2 * t
  const f = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) }
}

function clampCell(value: number, max: number): number {
  return Math.min(max, Math.max(0, value))
}

/** Superficie del reticolo in (u, v): bicubica Catmull-Rom sui nodi. Nodi a riposo = identità. */
export function gridPoint(grid: WarpGrid, u: number, v: number): Corner {
  const gu = u * grid.cols
  const gv = v * grid.rows
  const i = clampCell(Math.floor(gu), grid.cols - 1)
  const j = clampCell(Math.floor(gv), grid.rows - 1)
  const tu = gu - i
  const tv = gv - j
  const rows: Corner[] = []
  for (let k = -1; k <= 2; k++) {
    rows.push(
      catmullRom(
        gridNodeExtended(grid, i - 1, j + k),
        gridNodeExtended(grid, i, j + k),
        gridNodeExtended(grid, i + 1, j + k),
        gridNodeExtended(grid, i + 2, j + k),
        tu,
      ),
    )
  }
  return catmullRom(rows[0], rows[1], rows[2], rows[3], tv)
}

/**
 * Cambia la risoluzione del reticolo conservando la forma: i nodi nuovi si posizionano sulla
 * superficie attuale. Cambiare densità a metà allineamento non deve buttare via il lavoro.
 */
export function resampleGrid(grid: WarpGrid | undefined, cols: number, rows: number): WarpGrid {
  const next = createWarpGrid(cols, rows)
  if (!grid) return next
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const base = gridNodeBase(next, col, row)
      const p = gridPoint(grid, base.x, base.y)
      next.points[gridNodeIndex(next, col, row)] = { x: p.x - base.x, y: p.y - base.y }
    }
  }
  return next
}

// ---- Correzione dell'obiettivo (barile / cuscino) ----

/**
 * Limite della correzione. Non è un valore di comodo: il profilo radiale `lensRadius` resta
 * crescente su tutto il quadrato unitario **solo** per lens ≥ -0.5. Sotto, ha un massimo prima
 * del raggio d'angolo, quindi due raggi diversi finiscono sullo stesso punto e la mesh si
 * ripiega su sé stessa vicino agli angoli — un artefatto visibile, non solo un fastidio
 * matematico. Verificato: a -0.5 il massimo cade esattamente sull'angolo.
 */
export const LENS_LIMIT = 0.5

/** |(0.5, 0.5)|²: distanza al quadrato dell'angolo dal centro, usata per normalizzare il raggio. */
const LENS_MAX_R2 = 0.5

/**
 * Fattore radiale con i 4 angoli fermi: a raggio pieno (angolo) vale 1, al centro vale 1 - lens.
 * È questo ancoraggio che permette di correggere l'obiettivo senza spostare il corner-pin.
 */
function lensFactor(dx: number, dy: number, lens: number): number {
  const r2 = (dx * dx + dy * dy) / LENS_MAX_R2
  return 1 + lens * (r2 - 1)
}

export function applyLens(p: Corner, lens: number | undefined): Corner {
  if (!lens) return p
  const dx = p.x - 0.5
  const dy = p.y - 0.5
  const f = lensFactor(dx, dy, lens)
  return { x: 0.5 + dx * f, y: 0.5 + dy * f }
}

/**
 * Raggio dopo la correzione, in funzione del raggio prima: g(a) = |p'| quando |p| = a.
 * Sostituendo r² = a²/0.5 in `lensFactor` si ottiene a·f = (1-lens)·a + 2·lens·a³.
 * Serve a giustificare `LENS_LIMIT`: il massimo di g cade in a² = (1-lens)/(-6·lens), che per
 * lens = -0.5 vale esattamente il raggio d'angolo.
 */
export function lensRadius(a: number, lens: number): number {
  return 2 * lens * a * a * a + (1 - lens) * a
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

/**
 * Deformazione pronta all'uso, precalcolata una volta e riusata per tutti i vertici della mesh
 * (e per tutti i punti dell'overlay): evita di ricostruire curve e di rileggere la modalità a
 * ogni campione.
 */
export interface WarpEval {
  mode: WarpMode
  curves: WarpCurves
  grid: WarpGrid | null
  lens: number
}

export function warpEval(warp: Warp | null | undefined): WarpEval {
  return {
    mode: warpMode(warp),
    curves: warpCurves(warp),
    grid: warp?.grid ?? null,
    lens: warp?.lens ?? 0,
  }
}

/** (u, v) → punto unitario deformato: modalità attiva, poi correzione dell'obiettivo. */
export function warpUnit(ev: WarpEval, u: number, v: number): Corner {
  const p = ev.mode === 'grid' && ev.grid ? gridPoint(ev.grid, u, v) : coonsPoint(ev.curves, u, v)
  return applyLens(p, ev.lens)
}

/** Punto unitario deformato → mondo. `k` è il peso della correzione prospettica. */
export function warpPoint(
  ev: WarpEval,
  m: Homography,
  u: number,
  v: number,
): { x: number; y: number; k: number } {
  const p = warpUnit(ev, u, v)
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
  const common = { mode: warp.mode, grid: flipGrid(warp.grid, axis), lens: warp.lens }
  if (axis === 'horizontal') {
    // u → 1-u: i bordi orizzontali si percorrono al contrario, quelli verticali si scambiano
    return {
      ...common,
      top: [mirrorX(warp.top[1]), mirrorX(warp.top[0])],
      bottom: [mirrorX(warp.bottom[1]), mirrorX(warp.bottom[0])],
      left: [mirrorX(warp.right[0]), mirrorX(warp.right[1])],
      right: [mirrorX(warp.left[0]), mirrorX(warp.left[1])],
    }
  }
  // v → 1-v: speculare del caso sopra
  return {
    ...common,
    left: [mirrorY(warp.left[1]), mirrorY(warp.left[0])],
    right: [mirrorY(warp.right[1]), mirrorY(warp.right[0])],
    top: [mirrorY(warp.bottom[0]), mirrorY(warp.bottom[1])],
    bottom: [mirrorY(warp.top[0]), mirrorY(warp.top[1])],
  }
}

/** Specchia il reticolo insieme ai bordi: i nodi si riordinano e lo scostamento cambia segno. */
function flipGrid(grid: WarpGrid | undefined, axis: 'horizontal' | 'vertical'): WarpGrid | undefined {
  if (!grid) return undefined
  const next = createWarpGrid(grid.cols, grid.rows)
  for (let row = 0; row <= grid.rows; row++) {
    for (let col = 0; col <= grid.cols; col++) {
      const src = grid.points[gridNodeIndex(grid, col, row)] ?? { x: 0, y: 0 }
      const [dc, dr] =
        axis === 'horizontal' ? [grid.cols - col, row] : [col, grid.rows - row]
      next.points[gridNodeIndex(next, dc, dr)] =
        axis === 'horizontal' ? mirrorX(src) : mirrorY(src)
    }
  }
  return next
}

/**
 * Perimetro del quad campionato lungo i bordi curvi, in coordinate mondo: è il contorno reale
 * della proiezione, quello che l'overlay deve disegnare al posto del poligono a 4 lati.
 * L'ordine è TL → TR → BR → BL, cioè il giro del perimetro.
 */
export function warpOutline(corners: Corners, warp: Warp | null | undefined, samples = 16): Corner[] {
  const m = cornersHomography(corners)
  const ev = warpEval(warp)
  const points: Corner[] = []
  const push = (u: number, v: number) => {
    const p = warpPoint(ev, m, u, v)
    points.push({ x: p.x, y: p.y })
  }
  for (let i = 0; i < samples; i++) push(i / samples, 1) // alto: TL → TR
  for (let i = 0; i < samples; i++) push(1, 1 - i / samples) // destro: TR → BR
  for (let i = 0; i < samples; i++) push(1 - i / samples, 0) // basso: BR → BL
  for (let i = 0; i < samples; i++) push(0, i / samples) // sinistro: BL → TL
  return points
}
