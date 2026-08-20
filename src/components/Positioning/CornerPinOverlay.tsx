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
  edgeHandleBase,
  invertHomography,
  isWarpActive,
  warpCurves,
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
  const corners = activeLayer?.corners
  const warp = activeLayer?.warp
  const transform = activeLayer?.transform
  const locked = activeLayer?.locked ?? false
  const view = useUiStore((s) => s.view)
  const selection = useUiStore((s) => s.mappingSelection)
  const setSelection = useUiStore((s) => s.setMappingSelection)
  const warpMode = useUiStore((s) => s.warpMode)
  const snapEnabled = useUiStore((s) => s.snapEnabled)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const { width, height } = size

  // omografia del quad e sua inversa: servono a disegnare gli handle (unitario → mondo) e a
  // riconvertire il trascinamento (mondo → unitario), dove la curvatura è definita
  const homography = useMemo(() => (corners ? cornersHomography(corners) : null), [corners])
  const inverse = useMemo(() => (homography ? invertHomography(homography) : null), [homography])
  const curves = useMemo(() => warpCurves(warp), [warp])

  /** Punto in spazio unitario → pixel dell'overlay (curvatura + omografia + transform + vista). */
  const unitToScreen = (u: number, v: number) => {
    if (!homography || !transform) return { x: 0, y: 0 }
    const w = warpPoint(curves, homography, u, v)
    const r = applyTransform(w.x, w.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  }

  /** Punto unitario "puro" (senza curvatura): posizione degli handle Bézier, che vivono lì. */
  const controlToScreen = (p: Corner) => {
    if (!homography || !transform) return { x: 0, y: 0 }
    const w = applyHomographyPoint(homography, p.x, p.y)
    const r = applyTransform(w.x, w.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  }

  const handleCornerDrag =
    (index: 0 | 1 | 2 | 3) => (e: ReactPointerEvent<HTMLDivElement>) => {
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

      const onMove = (ev: PointerEvent) => {
        const world = screenToWorld(
          ev.clientX - rect.left,
          ev.clientY - rect.top,
          width,
          height,
          view,
        )
        const local = invertTransform(world.x, world.y, transform)
        const unit = applyHomographyPoint(inverse, local.x, local.y)
        setWarpHandle(edge, index, { x: unit.x - base.x, y: unit.y - base.y })
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
          style={{ pointerEvents: 'auto', cursor: locked ? 'not-allowed' : 'move' }}
          onPointerDown={handlePanStart}
        />
        {/* steli degli handle Bézier: legano il punto di controllo al bordo che curva */}
        {warpMode &&
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
      </svg>

      {/* maniglie centro-lato: selezionano il lato e muovono i suoi due angoli insieme */}
      {WARP_EDGES.map((edge) => {
        const p = unitToScreen(...edgeAnchorMid(edge))
        const isSelected = sameSelection(selection, { kind: 'edge', edge })
        return (
          <div
            key={`${edge}-mid`}
            title={`${WARP_EDGE_LABELS[edge]}: trascina per muovere i due angoli insieme`}
            onPointerDown={handleEdgeDrag(edge)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 border-white transition-[height,width]',
              isSelected ? 'h-4 w-4 ring-2 ring-white/70' : 'h-3 w-3',
              locked ? 'cursor-not-allowed bg-amber-500' : 'cursor-grab bg-purple-400 active:cursor-grabbing',
            )}
            style={{ left: p.x, top: p.y, pointerEvents: 'auto' }}
          />
        )
      })}

      {/* punti di controllo Bézier: solo in modalità curvatura, per non affollare il canvas */}
      {warpMode &&
        WARP_EDGES.flatMap((edge) =>
          ([0, 1] as const).map((i) => {
            const p = controlToScreen(currentControl(edge, i, warp))
            return (
              <div
                key={`${edge}-${i}-cp`}
                title={`${WARP_EDGE_LABELS[edge]}: curvatura (punto ${i + 1})`}
                onPointerDown={handleWarpDrag(edge, i)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-white',
                  locked ? 'cursor-not-allowed bg-amber-400' : 'cursor-grab bg-cyan-400 active:cursor-grabbing',
                )}
                style={{ left: p.x, top: p.y, pointerEvents: 'auto' }}
              />
            )
          }),
        )}

      {screenCorners.map((c, i) => {
        const isSelected = sameSelection(selection, { kind: 'corner', index: i as 0 | 1 | 2 | 3 })
        return (
          <div
            key={i}
            onPointerDown={handleCornerDrag(i as 0 | 1 | 2 | 3)}
            className={cn(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white transition-[height,width]',
              // l'angolo selezionato è più grande: è il bersaglio delle frecce, va riconosciuto subito
              isSelected ? 'h-5 w-5 ring-2 ring-white/70' : 'h-4 w-4',
              locked ? 'cursor-not-allowed bg-amber-500' : 'cursor-grab bg-purple-500 active:cursor-grabbing',
            )}
            style={{ left: c.x, top: c.y, pointerEvents: 'auto' }}
          />
        )
      })}
    </div>
  )
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
