import { RotateCcw, FlipHorizontal, FlipVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'
import { useLayersStore, DEFAULT_FX, type FxControls } from '@/store/layersStore'

interface FxSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** Come mostrare il valore; se assente usa 2 decimali. */
  format?: (v: number) => string
  onChange: (v: number) => void
}

function FxSlider({ label, value, min, max, step = 0.01, format, onChange }: FxSliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {format ? format(value) : value.toFixed(2)}
        </span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

const TAU = Math.PI * 2

/**
 * Controlli globali dell'effetto: agiscono nel wrapper GLSL, quindi funzionano su QUALSIASI
 * shader — compresi quelli che espongono pochi parametri propri e i visual generativi.
 */
export function FxControlsPanel() {
  const fx =
    useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.fx) ?? DEFAULT_FX
  const setFx = useLayersStore((s) => s.setActiveFx)
  const resetFx = useLayersStore((s) => s.resetActiveFx)

  const isDefault = (Object.keys(DEFAULT_FX) as (keyof FxControls)[]).every(
    (k) => fx[k] === DEFAULT_FX[k],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Controlli globali
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 px-1.5 text-[11px] text-muted-foreground"
          onClick={resetFx}
          disabled={isDefault}
          title="Riporta tutti i controlli globali ai valori neutri"
        >
          <RotateCcw className="size-3" />
          Reset
        </Button>
      </div>

      <FxSlider
        label="Velocità"
        value={fx.speed}
        min={0}
        max={4}
        format={(v) => `${v.toFixed(2)}×`}
        onChange={(speed) => setFx({ speed })}
      />

      <FxSlider
        label="Rotazione"
        value={fx.rotation}
        min={-Math.PI}
        max={Math.PI}
        format={(v) => `${Math.round((v / TAU) * 360)}°`}
        onChange={(rotation) => setFx({ rotation })}
      />

      <div className="grid grid-cols-2 gap-3">
        <FxSlider
          label="Pan X"
          value={fx.offsetX}
          min={-1}
          max={1}
          onChange={(offsetX) => setFx({ offsetX })}
        />
        <FxSlider
          label="Pan Y"
          value={fx.offsetY}
          min={-1}
          max={1}
          onChange={(offsetY) => setFx({ offsetY })}
        />
      </div>

      {/* Kaleido sotto 2 = disattivato: lo comunica l'etichetta, non serve un toggle separato */}
      <FxSlider
        label="Kaleidoscopio"
        value={fx.kaleido}
        min={0}
        max={16}
        step={1}
        format={(v) => (v < 2 ? 'off' : `${v} segm.`)}
        onChange={(kaleido) => setFx({ kaleido })}
      />

      <div className="flex gap-1.5">
        <Button
          variant={fx.mirrorX ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setFx({ mirrorX: !fx.mirrorX })}
        >
          <FlipHorizontal className="size-3.5" />
          Mirror X
        </Button>
        <Button
          variant={fx.mirrorY ? 'default' : 'outline'}
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => setFx({ mirrorY: !fx.mirrorY })}
        >
          <FlipVertical className="size-3.5" />
          Mirror Y
        </Button>
      </div>

      <FxSlider
        label="Pixelate"
        value={fx.pixelate}
        min={0}
        max={200}
        step={1}
        format={(v) => (v < 1 ? 'off' : `${v} px`)}
        onChange={(pixelate) => setFx({ pixelate })}
      />

      <FxSlider
        label="Luminosità"
        value={fx.brightness}
        min={0}
        max={3}
        onChange={(brightness) => setFx({ brightness })}
      />
      <FxSlider
        label="Contrasto"
        value={fx.contrast}
        min={0}
        max={4}
        onChange={(contrast) => setFx({ contrast })}
      />
      <FxSlider
        label="Saturazione"
        value={fx.saturation}
        min={0}
        max={3}
        onChange={(saturation) => setFx({ saturation })}
      />
      <FxSlider
        label="Posterize"
        value={fx.posterize}
        min={0}
        max={16}
        step={1}
        format={(v) => (v < 2 ? 'off' : `${v} liv.`)}
        onChange={(posterize) => setFx({ posterize })}
      />
      <FxSlider
        label="Negativo"
        value={fx.invert}
        min={0}
        max={1}
        format={(v) => `${Math.round(v * 100)}%`}
        onChange={(invert) => setFx({ invert })}
      />

      <p className={cn('text-[11px] leading-snug text-muted-foreground')}>
        Valgono per qualsiasi effetto, anche i visual generativi: agiscono sopra i parametri del
        singolo shader.
      </p>
    </div>
  )
}
