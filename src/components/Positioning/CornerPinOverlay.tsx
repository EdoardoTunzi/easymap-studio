import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Corner, Transform } from '../../store/projectStore'
import { useLayersStore } from '../../store/layersStore'
import {
  useUiStore,
  GRID_STEP,
  SELECT_ALL,
  sameSelection,
  type ViewTransform,
} from '../../store/uiStore'
import { snapCorner } from '../../lib/mappingGeometry'
import {
  applyHomographyPoint,
  cornersHomography,
  createWarpGrid,
  edgeHandleBase,
  gridNodeBase,
  gridNodePoint,
  invertHomography,
  isGridCornerNode,
  isWarpActive,
  warpEval,
  warpMode,
  warpOutline,
  warpPoint,
  WARP_EDGES,
  WARP_EDGE_CORNERS,
  WARP_EDGE_LABELS,
  type Warp,
  type WarpEdgeId,
} from '../../lib/warp'
import { cn } from '../../lib/utils'

// stesse formule usate dalla camera ortografica in StageCanvas, includendo lo zoom/pan di anteprima
// (view): frustum = -aspect/zoom+panX .. aspect/zoom+panX, -1/zoom+panY .. 1/zoom+panY
function frustum(width: number, height: number, view: ViewTransform) {
  const aspect = width / height
  const halfWidth = aspect / view.zoom
  const halfHeight = 1 / view.zoom
  return {
    left: -halfWidth + view.panX,
    right: halfWidth + view.panX,
    top: halfHeight + view.panY,
    bottom: -halfHeight + view.panY,
  }
}

function screenToWorld(px: number, py: number, width: number, height: number, view: ViewTransform) {
  const { left, right, top, bottom } = frustum(width, height, view)
  return {
    x: left + (px / width) * (right - left),
    y: top - (py / height) * (top - bottom),
  }
}

function worldToScreen(x: number, y: number, width: number, height: number, view: ViewTransform) {
  const { left, right, top, bottom } = frustum(width, height, view)
  return {
    x: ((x - left) / (right - left)) * width,
    y: ((top - y) / (top - bottom)) * height,
  }
}

// il mesh è renderizzato con transform globale: rendered = base * zoom + offset.
// Le maniglie vanno disegnate sulla posizione renderizzata, e il drag va riconvertito in base.
function applyTransform(x: number, y: number, t: Transform) {
  return { x: x * t.zoom + t.offsetX, y: y * t.zoom + t.offsetY }
}

function invertTransform(x: number, y: number, t: Transform) {
  return { x: (x - t.offsetX) / t.zoom, y: (y - t.offsetY) / t.zoom }
}

/** Overlay HTML/SVG per trascinare i 4 angoli del corner-pin, sovrapposto al canvas nella Control page. */
export function CornerPinOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const setCorner = useLayersStore((s) => s.setActiveCorner)
  const moveCorners = useLayersStore((s) => s.moveActiveCorners)
  const nudgeCorners = useLayersStore((s) => s.nudgeActiveCorners)
  const setWarpHandle = useLayersStore((s) => s.setActiveWarpHandle)
  const setGridNode = useLayersStore((s) => s.setActiveGridNode)
  const corners = activeLayer?.corners
  const warp = activeLayer?.warp
  const transform = activeLayer?.transform
  const locked = activeLayer?.locked ?? false
  const view = useUiStore((s) => s.view)
  const selection = useUiStore((s) => s.mappingSelection)
  const setSelection = useUiStore((s) => s.setMappingSelection)
  const editingWarp = useUiStore((s) => s.warpMode)
  const snapEnabled = useUiStore((s) => s.snapEnabled)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { width, height } = size

  // omografia del quad e sua inversa: servono a disegnare gli handle (unitario → mondo) e a
  // riconvertire il trascinamento (mondo → unitario), dove la curvatura è definita
  const homography = useMemo(() => (corners ? cornersHomography(corners) : null), [corners])
  const inverse = useMemo(() => (homography ? invertHomography(homography) : null), [homography])
  const ev = useMemo(() => warpEval(warp), [warp])
  const mode = warpMode(warp)
  const grid = warp?.grid ?? EMPTY_GRID

  /** Punto in spazio unitario → pixel dell'overlay (deformazione + omografia + transform + vista). */
  const unitToScreen = (u: number, v: number) => {
    if (!homography || !transform) return { x: 0, y: 0 }
    const w = warpPoint(ev, homography, u, v)
    const r = applyTransform(w.x, w.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  }

  /**
   * Maniglia (punto di controllo Bézier o nodo del reticolo) → pixel.
   *
   * Le maniglie vivono nello spazio unitario PRIMA della correzione dell'obiettivo, e non ci
   * passano attraverso: così `screenToControl` ne è l'inverso esatto, e il trascinamento segue il
   * puntatore alla perfezione in ogni condizione. Il prezzo è che con la lente spinta la maniglia
   * si stacca di poco dalla superficie che comanda — invertire la lente avrebbe reso il gesto
   * approssimato o appiccicoso proprio agli estremi, che è molto peggio da usare.
   */
  const controlToScreen = (p: Corner) => {
    if (!homography || !transform) return { x: 0, y: 0 }
    const w = applyHomographyPoint(homography, p.x, p.y)
    const r = applyTransform(w.x, w.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  }

  /** Pixel → spazio unitario delle maniglie: l'inverso esatto di `controlToScreen`. */
  const screenToControl = (clientX: number, clientY: number, rect: DOMRect): Corner | null => {
    if (!inverse || !transform) return null
    const world = screenToWorld(clientX - rect.left, clientY - rect.top, width, height, view)
    const local = invertTransform(world.x, world.y, transform)
    return applyHomographyPoint(inverse, local.x, local.y)
  }

  const handleCornerDrag = (index: 0 | 1 | 2 | 3) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // il click seleziona comunque l'angolo, così le frecce agiscono su quello appena toccato
    setSelection({ kind: 'corner', index })
    if (!transform || locked) return
    const rect = containerRef.current!.getBoundingClientRect()

    const onMove = (ev: PointerEvent) => {
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      let world = screenToWorld(px, py, width, height, view)
      // lo snap agisce sulla posizione renderizzata: è lì che l'utente vede la griglia
      if (snapEnabled) world = snapCorner(world, GRID_STEP)
      // la maniglia vive nello spazio renderizzato: riportala nello spazio base del corner
      setCorner(index, invertTransform(world.x, world.y, transform))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /**
   * Trascinamento di un intero lato: i due angoli che lo delimitano si muovono insieme, mantenendo
   * la loro distanza. È il gesto per alzare/abbassare un bordo intero senza rifare due angoli.
   */
  const handleEdgeDrag = (edge: WarpEdgeId) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setSelection({ kind: 'edge', edge })
    if (!transform || locked) return
    const { left, right, top, bottom } = frustum(width, height, view)
    const indices = WARP_EDGE_CORNERS[edge]
    let lastX = e.clientX
    let lastY = e.clientY

    const onMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - lastX
      const dyScreen = ev.clientY - lastY
      lastX = ev.clientX
      lastY = ev.clientY
      nudgeCorners(
        ((dxScreen / width) * (right - left)) / transform.zoom,
        (-(dyScreen / height) * (top - bottom)) / transform.zoom,
        indices,
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  /**
   * Trascinamento di un punto di controllo Bézier. Lo schermo si riporta in spazio unitario con
   * l'inversa dell'omografia: così l'handle segue il puntatore anche su un quad in forte keystone,
   * dove un pixel in alto vale molto più mondo di un pixel in basso.
   */
  const handleWarpDrag =
    (edge: WarpEdgeId, index: 0 | 1) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setSelection({ kind: 'edge', edge })
      if (!transform || locked || !inverse) return
      const rect = containerRef.current!.getBoundingClientRect()
      const base = edgeHandleBase(edge, index)

      const onMove = (pe: PointerEvent) => {
        const unit = screenToControl(pe.clientX, pe.clientY, rect)
        if (unit)
          setWarpHandle(edge, index, {
            x: unit.x - base.x,
            y: unit.y - base.y,
          })
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

  /** Trascinamento di un nodo del reticolo: stessa conversione degli handle Bézier. */
  const handleGridDrag = (col: number, row: number) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (!transform || locked || !inverse) return
    const rect = containerRef.current!.getBoundingClientRect()
    const base = gridNodeBase(grid, col, row)

    const onMove = (pe: PointerEvent) => {
      const unit = screenToControl(pe.clientX, pe.clientY, rect)
      if (unit) setGridNode(col, row, { x: unit.x - base.x, y: unit.y - base.y })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handlePanStart = (e: ReactPointerEvent<SVGPolygonElement>) => {
    e.preventDefault()
    setSelection(SELECT_ALL)
    if (!transform || locked) return
    const { left, right, top, bottom } = frustum(width, height, view)
    let lastX = e.clientX
    let lastY = e.clientY

    const onMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - lastX
      const dyScreen = ev.clientY - lastY
      lastX = ev.clientX
      lastY = ev.clientY
      // il delta schermo è nello spazio renderizzato (incluso lo zoom di anteprima): dividi per lo zoom del layer per ottenere il delta base
      moveCorners(
        ((dxScreen / width) * (right - left)) / transform.zoom,
        (-(dyScreen / height) * (top - bottom)) / transform.zoom,
      )
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  if (!width || !height || !corners || !transform) {
    return <div ref={containerRef} className="pointer-events-none absolute inset-0" />
  }

  const warped = isWarpActive(warp)
  // contorno reale della proiezione: coi bordi dritti sono i 4 angoli, con la curvatura è il
  // perimetro campionato lungo le Bézier
  const outlinePoints = (
    warped
      ? warpOutline(corners, warp).map((p) => {
          const r = applyTransform(p.x, p.y, transform)
          return worldToScreen(r.x, r.y, width, height, view)
        })
      : // TL, TR, BR, BL: ordine di perimetro (corners è TL, TR, BL, BR)
        [corners[0], corners[1], corners[3], corners[2]].map((c) => {
          const r = applyTransform(c.x, c.y, transform)
          return worldToScreen(r.x, r.y, width, height, view)
        })
  )
    .map((c) => `${c.x},${c.y}`)
    .join(' ')

  const screenCorners = corners.map((c) => {
    const r = applyTransform(c.x, c.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  })

  // bloccato = ambra e non trascinabile, così lo stato è leggibile a colpo d'occhio durante il live
  const stroke = locked ? 'rgba(251, 191, 36, 0.75)' : 'rgba(168, 85, 247, 0.6)'
  const fill = locked ? 'rgba(251, 191, 36, 0.06)' : 'rgba(168, 85, 247, 0.08)'

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full">
        <polygon
          points={outlinePoints}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={locked ? '6 4' : undefined}
          style={{
            pointerEvents: 'auto',
            cursor: locked ? 'not-allowed' : 'move',
          }}
          onPointerDown={handlePanStart}
        />
        {/* steli degli handle Bézier: legano il punto di controllo al bordo che curva */}
        {editingWarp &&
          mode === 'bezier' &&
          WARP_EDGES.flatMap((edge) =>
            ([0, 1] as const).map((i) => {
              const anchor = unitToScreen(...edgeAnchor(edge, i))
              const handle = controlToScreen(currentControl(edge, i, warp))
              return (
                <line
                  key={`${edge}-${i}-stem`}
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={handle.x}
                  y2={handle.y}
                  stroke="rgba(34, 211, 238, 0.5)"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              )
            }),
          )}

        {/* reticolo: le linee seguono la superficie deformata, non i segmenti fra i nodi, così
            si vede davvero come si piega la proiezione fra un nodo e l'altro */}
        {editingWarp &&
          mode === 'grid' &&
          gridLines(grid).map((line, i) => (
            <polyline
              key={`gridline-${i}`}
              points={line
                .map(([u, v]) => {
                  const p = unitToScreen(u, v)
                  return `${p.x},${p.y}`
                })
                .join(' ')}
              fill="none"
              stroke="rgba(34, 211, 238, 0.35)"
              strokeWidth={1}
            />
          ))}
      </svg>

      {/* Maniglie centro-lato: selezionano il lato e muovono i suoi due angoli insieme.
          Nascoste mentre si lavora col reticolo, perché a 3×3 nodi quelli di bordo cadono
          esattamente qui: due maniglie sovrapposte e diverse sono ingovernabili. Il lato resta
          selezionabile dai pulsanti della toolbar. */}
      {!(editingWarp && mode === 'grid') &&
        WARP_EDGES.map((edge) => {
          const p = unitToScreen(...edgeAnchorMid(edge))
          const isSelected = sameSelection(selection, { kind: 'edge', edge })
          return (
            <div
              key={`${edge}-mid`}
              title={`${WARP_EDGE_LABELS[edge]}: trascina per muovere i due angoli insieme`}
              onPointerDown={handleEdgeDrag(edge)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white transition-[height,width]',
                isSelected ? 'size-4 ring-2 ring-white/70' : 'size-3',
                locked
                  ? 'cursor-not-allowed bg-amber-500'
                  : 'cursor-grab bg-purple-400 active:cursor-grabbing',
              )}
              style={{ left: p.x, top: p.y, pointerEvents: 'auto' }}
            />
          )
        })}

      {/* punti di controllo Bézier: solo in modalità curvatura, per non affollare il canvas */}
      {editingWarp &&
        mode === 'bezier' &&
        WARP_EDGES.flatMap((edge) =>
          ([0, 1] as const).map((i) => {
            const p = controlToScreen(currentControl(edge, i, warp))
            return (
              <div
                key={`${edge}-${i}-cp`}
                title={`${WARP_EDGE_LABELS[edge]}: curvatura (punto ${i + 1})`}
                onPointerDown={handleWarpDrag(edge, i)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 size-3.5 rounded-full border-2 border-white',
                  locked
                    ? 'cursor-not-allowed bg-amber-400'
                    : 'cursor-grab bg-cyan-400 active:cursor-grabbing',
                )}
                style={{ left: p.x, top: p.y, pointerEvents: 'auto' }}
              />
            )
          }),
        )}

      {/* nodi del reticolo. I 4 d'angolo non si disegnano: lì comandano le maniglie del
          corner-pin, e due maniglie sovrapposte sullo stesso punto sarebbero ingovernabili */}
      {editingWarp &&
        mode === 'grid' &&
        gridNodes(grid).map(([col, row]) => {
          const p = controlToScreen(gridNodePoint(grid, col, row))
          return (
            <div
              key={`node-${col}-${row}`}
              title={`Nodo ${col + 1},${row + 1} del reticolo`}
              onPointerDown={handleGridDrag(col, row)}
              className={cn(
                'absolute -translate-x-1/2 -translate-y-1/2 size-3 rounded-sm border-2 border-white',
                locked
                  ? 'cursor-not-allowed bg-amber-400'
                  : 'cursor-grab bg-cyan-400 active:cursor-grabbing',
              )}
              style={{ left: p.x, top: p.y, pointerEvents: 'auto' }}
            />
          )
        })}

      {screenCorners.map((c, i) => {
        const isSelected = sameSelection(selection, {
          kind: 'corner',
          index: i as 0 | 1 | 2 | 3,
        })
        return (
          <div
            key={i}
            onPointerDown={handleCornerDrag(i as 0 | 1 | 2 | 3)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-[height,width]',
              // l'angolo selezionato è più grande: è il bersaglio delle frecce, va riconosciuto subito
              isSelected ? 'size-5 ring-2 ring-white/70' : 'size-4',
              locked
                ? 'cursor-not-allowed bg-amber-500'
                : 'cursor-grab bg-purple-500 active:cursor-grabbing',
            )}
            style={{ left: c.x, top: c.y, pointerEvents: 'auto' }}
          />
        )
      })}
    </div>
  )
}

/** Reticolo a riposo usato finché il layer non ne ha uno proprio: evita rami null nel rendering. */
const EMPTY_GRID = createWarpGrid()

/** Segmenti della griglia da disegnare, campionati lungo la superficie deformata. */
function gridLines(grid: { cols: number; rows: number }): [number, number][][] {
  const SAMPLES = 12
  const lines: [number, number][][] = []
  // linee a u costante (verticali) e a v costante (orizzontali), bordi esclusi: quelli sono già
  // il contorno del quad, ridisegnarli raddoppierebbe il tratto
  for (let col = 1; col < grid.cols; col++) {
    const u = col / grid.cols
    lines.push(Array.from({ length: SAMPLES + 1 }, (_, i) => [u, i / SAMPLES] as [number, number]))
  }
  for (let row = 1; row < grid.rows; row++) {
    const v = row / grid.rows
    lines.push(Array.from({ length: SAMPLES + 1 }, (_, i) => [i / SAMPLES, v] as [number, number]))
  }
  return lines
}

/** Nodi trascinabili: tutti tranne i 4 d'angolo, che sono le maniglie del corner-pin. */
function gridNodes(grid: { cols: number; rows: number }): [number, number][] {
  const out: [number, number][] = []
  for (let row = 0; row <= grid.rows; row++) {
    for (let col = 0; col <= grid.cols; col++) {
      if (!isGridCornerNode(grid, col, row)) out.push([col, row])
    }
  }
  return out
}

/** Punto sul bordo (spazio unitario) a cui aggancia lo stelo dell'handle: t = 1/3 e 2/3. */
function edgeAnchor(edge: WarpEdgeId, index: 0 | 1): [number, number] {
  const t = index === 0 ? 1 / 3 : 2 / 3
  switch (edge) {
    case 'top':
      return [t, 1]
    case 'bottom':
      return [t, 0]
    case 'left':
      return [0, t]
    case 'right':
      return [1, t]
  }
}

/** Centro del bordo in spazio unitario: posizione della maniglia di selezione del lato. */
function edgeAnchorMid(edge: WarpEdgeId): [number, number] {
  switch (edge) {
    case 'top':
      return [0.5, 1]
    case 'bottom':
      return [0.5, 0]
    case 'left':
      return [0, 0.5]
    case 'right':
      return [1, 0.5]
  }
}

/** Posizione corrente del punto di controllo: base del bordo dritto + scostamento salvato. */
function currentControl(edge: WarpEdgeId, index: 0 | 1, warp: Warp | undefined): Corner {
  const base = edgeHandleBase(edge, index)
  const h = warp?.[edge]?.[index]
  return { x: base.x + (h?.x ?? 0), y: base.y + (h?.y ?? 0) }
}
