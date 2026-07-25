import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useLayersStore, type Mask } from '../../store/layersStore'
import type { Transform } from '../../store/projectStore'
import { useUiStore, type ViewTransform } from '../../store/uiStore'

// stesse formule della camera ortografica / CornerPinOverlay, incluso lo zoom/pan di anteprima (view)
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
function worldToScreen(x: number, y: number, width: number, height: number, view: ViewTransform) {
  const { left, right, top, bottom } = frustum(width, height, view)
  return { x: ((x - left) / (right - left)) * width, y: ((top - y) / (top - bottom)) * height }
}
function screenToWorld(px: number, py: number, width: number, height: number, view: ViewTransform) {
  const { left, right, top, bottom } = frustum(width, height, view)
  return { x: left + (px / width) * (right - left), y: top - (py / height) * (top - bottom) }
}
function applyTransform(x: number, y: number, t: Transform) {
  return { x: x * t.zoom + t.offsetX, y: y * t.zoom + t.offsetY }
}
function invertTransform(x: number, y: number, t: Transform) {
  return { x: (x - t.offsetX) / t.zoom, y: (y - t.offsetY) / t.zoom }
}
/** Ruota (CCW) un vettore in coordinate mondo (y verso l'alto). */
function rotateCCW(x: number, y: number, a: number) {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return { x: x * c - y * s, y: x * s + y * c }
}

/** Overlay per posizionare/ridimensionare le maschere di forma del layer attivo (solo pannello Mask). */
export function MaskOverlay() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const activeMaskId = useLayersStore((s) => s.activeMaskId)
  const selectMask = useLayersStore((s) => s.selectMask)
  const updateMask = useLayersStore((s) => s.updateMask)

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
  const transform = activeLayer?.transform
  const masks = activeLayer?.masks ?? []
  const view = useUiStore((s) => s.view)

  if (!width || !height || !transform) {
    return <div ref={containerRef} className="absolute inset-0" />
  }

  const { top, bottom } = frustum(width, height, view)
  const scale = (transform.zoom * height) / (top - bottom) // pixel per unità (corner-space), uniforme x/y

  // centro schermo di una maschera
  const centerScreen = (m: Mask) => {
    const r = applyTransform(m.cx, m.cy, transform)
    return worldToScreen(r.x, r.y, width, height, view)
  }
  // punto locale (spazio maschera) → schermo
  const localToScreen = (m: Mask, lx: number, ly: number) => {
    const v = rotateCCW(lx, ly, m.rotation)
    const c = centerScreen(m)
    return { x: c.x + v.x * scale, y: c.y - v.y * scale }
  }
  // punto schermo → locale (spazio maschera, non ruotato)
  const screenToLocal = (m: Mask, px: number, py: number) => {
    const rw = screenToWorld(px, py, width, height, view)
    const corner = invertTransform(rw.x, rw.y, transform)
    const d = rotateCCW(corner.x - m.cx, corner.y - m.cy, -m.rotation)
    return d
  }

  const outline = (m: Mask) => {
    const pts: { x: number; y: number }[] = []
    if (m.type === 'rectangle') {
      pts.push(localToScreen(m, -m.hx, m.hy), localToScreen(m, m.hx, m.hy), localToScreen(m, m.hx, -m.hy), localToScreen(m, -m.hx, -m.hy))
    } else {
      for (let i = 0; i < 40; i++) {
        const t = (i / 40) * Math.PI * 2
        pts.push(localToScreen(m, Math.cos(t) * m.hx, Math.sin(t) * m.hy))
      }
    }
    return pts.map((p) => `${p.x},${p.y}`).join(' ')
  }

  const handleMove = (m: Mask) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    selectMask(m.id)
    let last = { x: e.clientX, y: e.clientY }
    const onMove = (ev: PointerEvent) => {
      const dxScreen = ev.clientX - last.x
      const dyScreen = ev.clientY - last.y
      last = { x: ev.clientX, y: ev.clientY }
      const cur = useLayersStore.getState().layers.find((l) => l.id === activeLayer!.id)?.masks.find((x) => x.id === m.id)
      if (!cur) return
      updateMask(m.id, { cx: cur.cx + dxScreen / scale, cy: cur.cy - dyScreen / scale })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const handleResize = (m: Mask) => (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    selectMask(m.id)
    const rect = containerRef.current!.getBoundingClientRect()
    const onMove = (ev: PointerEvent) => {
      const px = ev.clientX - rect.left
      const py = ev.clientY - rect.top
      const local = screenToLocal(m, px, py)
      updateMask(m.id, { hx: Math.max(Math.abs(local.x), 0.02), hy: Math.max(Math.abs(local.y), 0.02) })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      <svg className="absolute inset-0 h-full w-full">
        {masks.map((m) => {
          const isSel = m.id === activeMaskId
          const handle = localToScreen(m, m.hx, m.hy)
          return (
            <g key={m.id}>
              <polygon
                points={outline(m)}
                fill={isSel ? 'rgba(56, 189, 248, 0.12)' : 'rgba(56, 189, 248, 0.04)'}
                stroke={isSel ? 'rgba(56, 189, 248, 0.9)' : 'rgba(56, 189, 248, 0.45)'}
                strokeWidth={isSel ? 1.75 : 1.25}
                strokeDasharray={m.invert ? '5 4' : undefined}
                style={{ pointerEvents: 'auto', cursor: 'move' }}
                onPointerDown={handleMove(m)}
              />
              {isSel && (
                <circle
                  cx={handle.x}
                  cy={handle.y}
                  r={7}
                  fill="rgb(56, 189, 248)"
                  stroke="white"
                  strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'nwse-resize' }}
                  onPointerDown={handleResize(m)}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
