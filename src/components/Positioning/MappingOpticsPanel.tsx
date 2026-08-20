import { Aperture, Feather } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { useLayersStore } from '@/store/layersStore'
import { LENS_LIMIT } from '@/lib/warp'

/**
 * Le due regolazioni del mapping che vogliono un valore continuo invece di un gesto sul canvas:
 * la correzione della distorsione dell'obiettivo e la sfumatura del perimetro proiettato.
 * Entrambe si giudicano guardando l'oggetto reale mentre si scorre lo slider, non trascinando
 * una maniglia.
 */
export function MappingOpticsPanel() {
  const layer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const setLens = useLayersStore((s) => s.setActiveLens)
  const setFeather = useLayersStore((s) => s.setActiveEdgeFeather)

  const locked = layer?.locked ?? false
  const lens = layer?.warp?.lens ?? 0
  const feather = layer?.edgeFeather ?? 0

  if (!layer) return null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Aperture className="size-3.5" />
            Obiettivo
          </span>
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {lens > 0 ? '+' : ''}
            {lens.toFixed(2)}
          </span>
        </div>
        <Slider
          min={-LENS_LIMIT}
          max={LENS_LIMIT}
          step={0.01}
          value={[lens]}
          onValueChange={([v]) => setLens(v)}
          disabled={locked}
          aria-label="Correzione dell'obiettivo"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Corregge la distorsione dell'ottica: a sinistra i bordi si gonfiano (barile), a destra
          rientrano (cuscino). I 4 angoli restano fermi, quindi l'allineamento non si perde.
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Feather className="size-3.5" />
            Sfumatura bordi
          </span>
          <span className="rounded bg-muted/60 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {feather === 0 ? 'off' : feather.toFixed(2)}
          </span>
        </div>
        <Slider
          min={0}
          max={0.5}
          step={0.01}
          value={[feather]}
          onValueChange={([v]) => setFeather(v)}
          aria-label="Sfumatura dei bordi della proiezione"
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Sfuma il perimetro della proiezione invece di tagliarlo di netto: la luce muore
          gradualmente sull'oggetto, e due proiettori affiancati si fondono senza una riga in mezzo.
        </p>
      </div>
    </div>
  )
}
