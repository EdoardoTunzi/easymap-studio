import { Dices, Power } from 'lucide-react'
import { useUiStore } from '@/store/uiStore'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ControlRow } from '@/components/layout/ControlRow'
import { cn } from '@/lib/utils'
import {
  PALETTE_PRESETS,
  PALETTE_STOPS,
  createDefaultPalette,
  randomPaletteColors,
  rgbToHex,
  hexToRgb,
  type RGB,
} from '@/store/paletteStore'
import { useLayersStore } from '@/store/layersStore'

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
  const activeLayerId = useLayersStore((s) => s.activeLayerId)
  const stopPaletteLoopFor = useUiStore((s) => s.stopPaletteLoopFor)
  const setEnabled = useLayersStore((s) => s.setPaletteEnabled)
  const setAmount = useLayersStore((s) => s.setPaletteAmount)
  const setCount = useLayersStore((s) => s.setPaletteCount)
  const setColor = useLayersStore((s) => s.setPaletteColor)
  const setColors = useLayersStore((s) => s.setPaletteColors)
  const applyPreset = useLayersStore((s) => s.applyPalettePreset)

  return (
    <div className="flex flex-col gap-5">
      <Button
        variant={enabled ? 'default' : 'outline'}
        onClick={() => {
          const next = !enabled
          setEnabled(next)
          // come nel pannello Shader: senza spegnere il loop, al primo tick la palette
          // si riaccenderebbe da sola (il loop la riabilita ogni volta che scrive)
          if (!next && activeLayerId) stopPaletteLoopFor(activeLayerId)
        }}
        className="press w-full gap-2"
      >
        <Power data-icon="inline-start" />
        {enabled ? 'Palette attiva' : 'Palette disattivata'}
      </Button>

      {/* Anteprima del gradiente: si smorza quando la palette è spenta, così lo stato si legge
          anche senza rileggere l'etichetta del pulsante (§16, feedback di stato). */}
      <div
        className="h-8 w-full rounded-lg border border-border transition-opacity duration-[--dur-base] ease-[--ease-out]"
        style={{ background: gradientCss(colors, count), opacity: enabled ? 1 : 0.4 }}
      />

      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">Preset</span>
        <div className="grid grid-cols-2 gap-2">
          {PALETTE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset.name)}
              className={cn(
                'press flex cursor-pointer flex-col gap-1 rounded-lg border p-1.5 text-left',
                'transition-colors duration-[--dur-fast] ease-[--ease-out]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
                activePreset === preset.name
                  ? 'border-primary/60 bg-secondary'
                  : 'border-border hover:border-muted-foreground hover:bg-accent/40',
              )}
            >
              <span
                className="h-4 w-full rounded"
                style={{ background: gradientCss(preset.colors, preset.colors.length) }}
              />
              <span className="ui-sublabel truncate text-muted-foreground">{preset.name}</span>
            </button>
          ))}
        </div>
        {/* Generatore casuale: colori armonici da scuro ad acceso, attiva la palette.
            Il numero scelto diventa anche il conteggio degli stop attivi. */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setColors(randomPaletteColors(count), count)}
          className="press gap-1.5"
        >
          <Dices data-icon="inline-start" />
          Palette casuale ({count} colori)
        </Button>
        <div className="flex items-center gap-1.5">
          <span className="ui-sublabel shrink-0 text-muted-foreground">Genera con</span>
          {[2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              variant={count === n ? 'secondary' : 'outline'}
              size="sm"
              className="press flex-1 px-0 tabular-nums"
              onClick={() => setColors(randomPaletteColors(n), n)}
              title={`Genera una palette casuale di ${n} colori`}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {/* -mx-4: il divisorio arriva ai bordi del pannello, come nelle altre colonne */}
      <div className="-mx-4 border-t border-sidebar-border/60" />

      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">
          Colori {activePreset === 'Custom' ? '(personalizzata)' : ''}
        </span>
        <div className="flex gap-2">
          {colors.slice(0, count).map((c, i) => (
            <label
              key={i}
              className="press relative size-9 flex-1 cursor-pointer overflow-hidden rounded-lg border border-border"
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
        <p className="ui-sublabel text-muted-foreground/80">
          Clicca un colore per modificarlo e creare la tua palette.
        </p>
      </div>

      <ControlRow label="Numero colori" value={String(count)}>
        <Slider
          min={2}
          max={PALETTE_STOPS}
          step={1}
          value={[count]}
          onValueChange={([v]) => setCount(v)}
          aria-label="Numero di colori della palette"
        />
      </ControlRow>

      <ControlRow
        label="Intensità"
        value={`${Math.round(amount * 100)}%`}
        hint="Quanto la palette copre i colori nativi dell'effetto: a 0% resta l'originale, al 100% è ricolorato del tutto."
      >
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[amount]}
          onValueChange={([v]) => setAmount(v)}
          aria-label="Intensità della palette"
        />
      </ControlRow>
    </div>
  )
}
