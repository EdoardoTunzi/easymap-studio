import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Crosshair,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { useProjectStore } from '@/store/projectStore'

const PAN_STEP = 0.05
const ZOOM_MIN = 0.1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.05

export function MovePanel() {
  const transform = useProjectStore((s) => s.transform)
  const setTransform = useProjectStore((s) => s.setTransform)
  const resetTransform = useProjectStore((s) => s.resetTransform)

  const pan = (dx: number, dy: number) =>
    setTransform({ offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy })

  const changeZoom = (delta: number) =>
    setTransform({
      zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, transform.zoom + delta)),
    })

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Posizione
        </span>
        {/* pad direzionale 3x3 */}
        <div className="grid grid-cols-3 gap-1.5">
          <div />
          <Button variant="secondary" size="icon" onClick={() => pan(0, PAN_STEP)} aria-label="Su">
            <ArrowUp className="size-4" />
          </Button>
          <div />
          <Button variant="secondary" size="icon" onClick={() => pan(-PAN_STEP, 0)} aria-label="Sinistra">
            <ArrowLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTransform({ offsetX: 0, offsetY: 0 })}
            aria-label="Centra"
          >
            <Crosshair className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" onClick={() => pan(PAN_STEP, 0)} aria-label="Destra">
            <ArrowRight className="size-4" />
          </Button>
          <div />
          <Button variant="secondary" size="icon" onClick={() => pan(0, -PAN_STEP)} aria-label="Giù">
            <ArrowDown className="size-4" />
          </Button>
          <div />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Zoom
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {transform.zoom.toFixed(2)}×
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changeZoom(-ZOOM_STEP)} aria-label="Riduci zoom">
            <ZoomOut className="size-4" />
          </Button>
          <Slider
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            value={[transform.zoom]}
            onValueChange={([v]) => setTransform({ zoom: v })}
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={() => changeZoom(ZOOM_STEP)} aria-label="Aumenta zoom">
            <ZoomIn className="size-4" />
          </Button>
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={resetTransform} className="gap-1.5">
        <RotateCcw className="size-3.5" />
        Reset posizione e zoom
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Sposta e ridimensiona l'intera proiezione. Per deformare i singoli angoli usa il corner-pin
        trascinando le maniglie sul preview.
      </p>
    </div>
  )
}
