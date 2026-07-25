import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { Transform } from '../../store/projectStore'
import { useLayersStore } from '../../store/layersStore'
import { useUiStore, type ViewTransform } from '../../store/uiStore'

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
  const corners = activeLayer?.corners
  const transform = activeLayer?.transform
  const view = useUiStore((s) => s.view)

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

  const handleCornerDrag =
    (index: 0 | 1 | 2 | 3) => (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!transform) return
      const rect = containerRef.current!.getBoundingClientRect()

      const onMove = (ev: PointerEvent) => {
        const px = ev.clientX - rect.left
        const py = ev.clientY - rect.top
        const world = screenToWorld(px, py, width, height, view)
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

  const handlePanStart = (e: ReactPointerEvent<SVGPolygonElement>) => {
    e.preventDefault()
    if (!transform) return
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

  const screenCorners = corners.map((c) => {
    const r = applyTransform(c.x, c.y, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  })
  // corners sono TL,TR,BL,BR: il poligono va tracciato in ordine di perimetro TL,TR,BR,BL
  const polygonPoints = [screenCorners[0], screenCorners[1], screenCorners[3], screenCorners[2]]
    .map((c) => `${c.x},${c.y}`)
    .join(' ')

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full">
        <polygon
          points={polygonPoints}
          fill="rgba(168, 85, 247, 0.08)"
          stroke="rgba(168, 85, 247, 0.6)"
          strokeWidth={1.5}
          style={{ pointerEvents: 'auto', cursor: 'move' }}
          onPointerDown={handlePanStart}
        />
      </svg>
      {screenCorners.map((c, i) => (
        <div
          key={i}
          onPointerDown={handleCornerDrag(i as 0 | 1 | 2 | 3)}
          className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-white bg-purple-500 active:cursor-grabbing"
          style={{ left: c.x, top: c.y, pointerEvents: 'auto' }}
        />
      ))}
    </div>
  )
}
