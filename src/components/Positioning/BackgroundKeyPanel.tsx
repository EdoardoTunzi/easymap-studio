import { Slider } from '@/components/ui/slider'
import { useLayersStore } from '@/store/layersStore'

export function BackgroundKeyPanel() {
  const lumaKey = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.lumaKey ?? 0)
  const setLumaKey = useLayersStore((s) => s.setActiveLumaKey)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Rimuovi sfondo scuro
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {lumaKey <= 0 ? 'off' : lumaKey.toFixed(2)}
        </span>
      </div>
      <Slider
        min={0}
        max={0.6}
        step={0.01}
        value={[lumaKey]}
        onValueChange={([v]) => setLumaKey(v)}
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        Se l'immagine ha lo sfondo nero (non trasparente), alza questo valore per far vedere
        l'effetto solo sul soggetto. Con un PNG già scontornato lascia su “off”.
      </p>
    </div>
  )
}
