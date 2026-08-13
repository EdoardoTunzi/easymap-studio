import { useEffect, useRef, useState } from 'react'
import { useUiStore, GRID_DIVISIONS } from '../../store/uiStore'

/**
 * Griglia di riferimento disegnata sopra il canvas di anteprima (solo Control: l'Output non la
 * disegna mai). Le linee sono in coordinate mondo e seguono zoom/pan della vista, così coincidono
 * con i punti a cui si agganciano i corner quando lo snap è attivo.
 */
export function AlignmentGrid() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
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
  if (!width || !height) {
    return <div ref={containerRef} className="pointer-events-none absolute inset-0" />
  }

  // il frustum verticale è alto 2 unità mondo: una cella misura 2 / GRID_DIVISIONS
  const aspect = width / height
  const halfHeight = 1 / view.zoom
  const halfWidth = aspect / view.zoom
  const cellWorld = 2 / GRID_DIVISIONS
  const cellPx = (cellWorld / (2 * halfHeight)) * height

  // offset della prima linea: la griglia è ancorata all'origine del mondo, non al bordo del canvas
  const originX = ((0 - (-halfWidth + view.panX)) / (2 * halfWidth)) * width
  const originY = ((halfHeight + view.panY - 0) / (2 * halfHeight)) * height

  const lines: { x1: number; y1: number; x2: number; y2: number; axis: boolean }[] = []
  const firstVertical = originX - Math.ceil(originX / cellPx) * cellPx
  for (let x = firstVertical; x <= width; x += cellPx) {
    lines.push({ x1: x, y1: 0, x2: x, y2: height, axis: Math.abs(x - originX) < 0.5 })
  }
  const firstHorizontal = originY - Math.ceil(originY / cellPx) * cellPx
  for (let y = firstHorizontal; y <= height; y += cellPx) {
    lines.push({ x1: 0, y1: y, x2: width, y2: y, axis: Math.abs(y - originY) < 0.5 })
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full">
        {lines.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            // gli assi centrali sono più marcati: sono il riferimento per centrare la proiezione
            stroke={l.axis ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)'}
            strokeWidth={l.axis ? 1.5 : 1}
          />
        ))}
      </svg>
    </div>
  )
}
