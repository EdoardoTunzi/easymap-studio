import { Button } from '@/components/ui/button'
import { useLayersStore } from '@/store/layersStore'
import { ALT_LABEL } from '@/hooks/use-effect-hotkeys'
import { OSCILLOSCOPE_PRESETS } from '@/lib/oscilloscopePresets'

/**
 * Forme pronte dell'oscilloscopio. Compaiono solo su questo effetto: sono scorciatoie ai suoi
 * parametri, non una funzione generale della libreria.
 *
 * Ogni preset viaggia come una sola scrittura nello store (`setActiveParams`): applicarne uno
 * con quindici chiamate separate significherebbe quindici invii della scena all'Output.
 */
export function OscilloscopePresets() {
  const setActiveParams = useLayersStore((s) => s.setActiveParams)

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border p-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Forme rapide
      </span>
      <div className="grid grid-cols-3 gap-1.5">
        {OSCILLOSCOPE_PRESETS.map((preset, i) => (
          <Button
            key={preset.id}
            variant="outline"
            size="sm"
            className="h-7 justify-center px-1 text-[11px]"
            onClick={() => setActiveParams(preset.params)}
            title={`${preset.hint} (${ALT_LABEL}${i + 1})`}
          >
            <span className="truncate">{preset.label}</span>
          </Button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Anche da tastiera: {ALT_LABEL}1…{ALT_LABEL}
        {OSCILLOSCOPE_PRESETS.length}. Volume e reattività non vengono toccati.
      </p>
    </div>
  )
}
