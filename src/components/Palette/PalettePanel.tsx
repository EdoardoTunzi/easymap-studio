import { Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  PALETTE_PRESETS,
  PALETTE_STOPS,
  createDefaultPalette,
  type RGB,
} from '@/store/paletteStore'
import { useLayersStore } from '@/store/layersStore'

function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function hexToRgb(hex: string): RGB {
  const n = hex.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ]
}

/** CSS linear-gradient dalle prime `count` fermate. */
function gradientCss(colors: RGB[], count: number): string {
  const stops = colors.slice(0, count).map((c, i) => {
    const pos = count > 1 ? (i / (count - 1)) * 100 : 0
    return `${rgbToHex(c)} ${pos}%`
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}

export function PalettePanel() {
  const palette =
    useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.palette) ??
    createDefaultPalette()
  const { enabled, colors, count, amount, activePreset } = palette
  const setEnabled = useLayersStore((s) => s.setPaletteEnabled)
  const setAmount = useLayersStore((s) => s.setPaletteAmount)
  const setCount = useLayersStore((s) => s.setPaletteCount)
  const setColor = useLayersStore((s) => s.setPaletteColor)
  const applyPreset = useLayersStore((s) => s.applyPalettePreset)

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant={enabled ? 'default' : 'outline'}
        onClick={() => setEnabled(!enabled)}
        className="w-full gap-2"
      >
        <Power className="size-4" />
        {enabled ? 'Palette attiva' : 'Palette disattivata'}
      </Button>

      {/* anteprima gradiente corrente */}
      <div
        className="h-8 w-full rounded-md border border-border"
        style={{ background: gradientCss(colors, count) }}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Preset
        </span>
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.name)}
              className={cn(
                'flex flex-col gap-1 rounded-md border p-1.5 text-left transition-colors',
                activePreset === preset.name
                  ? 'border-primary'
                  : 'border-border hover:border-muted-foreground',
              )}
            >
              <span
                className="h-4 w-full rounded"
                style={{ background: gradientCss(preset.colors, preset.colors.length) }}
              />
              <span className="text-[11px] text-muted-foreground">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Colori {activePreset === 'Custom' ? '(personalizzata)' : ''}
        </span>
        <div className="flex gap-2">
          {colors.slice(0, count).map((c, i) => (
            <label
              key={i}
              className="relative size-9 flex-1 cursor-pointer overflow-hidden rounded-md border border-border"
              style={{ background: rgbToHex(c) }}
            >
              <input
                type="color"
                value={rgbToHex(c)}
                onChange={(e) => setColor(i, hexToRgb(e.target.value))}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Tocca un colore per modificarlo e creare la tua palette.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Numero colori
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
        </div>
        <Slider
          min={2}
          max={PALETTE_STOPS}
          step={1}
          value={[count]}
          onValueChange={([v]) => setCount(v)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Intensità
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {Math.round(amount * 100)}%
          </span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[amount]} onValueChange={([v]) => setAmount(v)} />
      </div>
    </div>
  )
}
