import { useEffect, useRef, type RefObject } from 'react'
import { Minus, Plus, Scan, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/store/uiStore'

const WHEEL_STEP = 1.15
const BUTTON_STEP = 1.3

/**
 * Gestisce zoom (rotellina) e pan (Spazio+drag o click centrale) della vista di anteprima
 * nel container passato. Puramente visivo (uiStore.view): non tocca mai corners/transform dei
 * layer, quindi non ha alcun effetto sull'Output.
 */
export function useViewportPanZoom(containerRef: RefObject<HTMLElement | null>) {
  const spaceHeldRef = useRef(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP
      useUiStore.getState().zoomViewBy(factor)
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      spaceHeldRef.current = true
      el.style.cursor = 'grab'
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      spaceHeldRef.current = false
      el.style.cursor = ''
    }

    const onPointerDown = (e: PointerEvent) => {
      const isMiddleClick = e.button === 1
      if (!spaceHeldRef.current && !isMiddleClick) return
      e.preventDefault()
      el.style.cursor = 'grabbing'
      let lastX = e.clientX
      let lastY = e.clientY
      const width = el.clientWidth
      const height = el.clientHeight
      const aspect = width / height

      const onMove = (ev: PointerEvent) => {
        const dxScreen = ev.clientX - lastX
        const dyScreen = ev.clientY - lastY
        lastX = ev.clientX
        lastY = ev.clientY
        const zoom = useUiStore.getState().view.zoom
        const halfWidth = aspect / zoom
        const halfHeight = 1 / zoom
        useUiStore
          .getState()
          .panView((-dxScreen / width) * 2 * halfWidth, (dyScreen / height) * 2 * halfHeight)
      }
      const onUp = () => {
        el.style.cursor = spaceHeldRef.current ? 'grab' : ''
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [containerRef])
}

/**
 * Mini toolbar flottante in basso a destra: zoom in/out/reset della vista di anteprima e
 * visibilità degli overlay di mapping.
 */
export function ViewportZoomControls() {
  const zoom = useUiStore((s) => s.view.zoom)
  const zoomViewBy = useUiStore((s) => s.zoomViewBy)
  const resetView = useUiStore((s) => s.resetView)
  const overlaysVisible = useUiStore((s) => s.overlaysVisible)
  const toggleOverlays = useUiStore((s) => s.toggleOverlays)

  return (
    <div className="pointer-events-auto absolute bottom-3 right-3 flex items-center gap-0.5 rounded-lg border border-white/10 bg-black/70 p-1 backdrop-blur-sm">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Riduci zoom vista"
        onClick={() => zoomViewBy(1 / BUTTON_STEP)}
      >
        <Minus className="size-3.5" />
      </Button>
      <button
        type="button"
        title="Reset vista"
        onClick={resetView}
        className="min-w-11 rounded px-1.5 text-center text-xs tabular-nums text-white/70 hover:text-white"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Aumenta zoom vista"
        onClick={() => zoomViewBy(BUTTON_STEP)}
      >
        <Plus className="size-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Adatta vista (100%)"
        onClick={resetView}
      >
        <Scan className="size-3.5" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

      {/* Nasconde maniglie e cornice del mapping: servono a posizionare, ma coprono l'effetto
          quando lo si vuole valutare davvero. */}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title={
          overlaysVisible
            ? 'Nascondi i riferimenti di mapping (cornice e maniglie)'
            : 'Mostra i riferimenti di mapping (cornice e maniglie)'
        }
        aria-pressed={!overlaysVisible}
        onClick={toggleOverlays}
        className={cn(!overlaysVisible && 'text-amber-400 hover:text-amber-300')}
      >
        {overlaysVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
      </Button>
    </div>
  )
}
