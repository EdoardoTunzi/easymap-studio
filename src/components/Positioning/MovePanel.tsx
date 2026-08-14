import type { ComponentType } from 'react'
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
import { cn } from '@/lib/utils'
import { DEFAULT_TRANSFORM } from '@/store/projectStore'
import { useLayersStore } from '@/store/layersStore'

const PAN_STEP = 0.05
const ZOOM_MIN = 0.1
const ZOOM_MAX = 4
const ZOOM_STEP = 0.05

/** Tasto del pad direzionale: dimensione fissa, così le tre colonne restano una croce regolare. */
function PadButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-md border border-border/50 bg-secondary/60 text-muted-foreground shadow-sm transition-colors outline-none hover:bg-secondary hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px"
    >
      <Icon className="size-4" />
    </button>
  )
}

export function MovePanel() {
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const setTransform = useLayersStore((s) => s.setActiveTransform)
  const resetTransform = useLayersStore((s) => s.resetActiveTransform)
  const transform = activeLayer?.transform ?? DEFAULT_TRANSFORM

  const pan = (dx: number, dy: number) =>
    setTransform({ offsetX: transform.offsetX + dx, offsetY: transform.offsetY + dy })

  const changeZoom = (delta: number) =>
    setTransform({
      zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, transform.zoom + delta)),
    })

  const centered = transform.offsetX === 0 && transform.offsetY === 0
  const isDefault = centered && transform.zoom === DEFAULT_TRANSFORM.zoom

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Posizione
          </span>
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {transform.offsetX.toFixed(2)} : {transform.offsetY.toFixed(2)}
          </span>
        </div>

        {/* pad direzionale 3x3: colonne a larghezza fissa e blocco centrato, altrimenti le frecce
            si allontanano seguendo la larghezza del pannello e la croce non si legge più */}
        <div className="flex justify-center">
          <div className="grid grid-cols-3 gap-1 rounded-xl border border-border/50 bg-muted/25 p-1.5">
            <span />
            <PadButton icon={ArrowUp} label="Su" onClick={() => pan(0, PAN_STEP)} />
            <span />

            <PadButton icon={ArrowLeft} label="Sinistra" onClick={() => pan(-PAN_STEP, 0)} />
            <button
              type="button"
              onClick={() => setTransform({ offsetX: 0, offsetY: 0 })}
              title="Centra"
              aria-label="Centra"
              disabled={centered}
              className={cn(
                'flex size-9 items-center justify-center rounded-md border transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:translate-y-px',
                centered
                  ? 'border-transparent text-muted-foreground/30'
                  : 'border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Crosshair className="size-4" />
            </button>
            <PadButton icon={ArrowRight} label="Destra" onClick={() => pan(PAN_STEP, 0)} />

            <span />
            <PadButton icon={ArrowDown} label="Giù" onClick={() => pan(0, -PAN_STEP)} />
            <span />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Dimensione
          </span>
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {transform.zoom.toFixed(2)}×
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={transform.zoom <= ZOOM_MIN}
            aria-label="Riduci zoom"
          >
            <ZoomOut className="size-3.5" />
          </Button>
          <Slider
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={ZOOM_STEP}
            value={[transform.zoom]}
            onValueChange={([v]) => setTransform({ zoom: v })}
            className="flex-1"
            aria-label="Zoom"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={transform.zoom >= ZOOM_MAX}
            aria-label="Aumenta zoom"
          >
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={resetTransform}
        disabled={isDefault}
        className="w-full gap-1.5"
      >
        <RotateCcw className="size-3.5" />
        Reset
      </Button>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Sposta e ridimensiona l'intera proiezione. Per deformare i singoli angoli usa il corner-pin
        trascinando le maniglie sul preview.
      </p>
    </div>
  )
}
