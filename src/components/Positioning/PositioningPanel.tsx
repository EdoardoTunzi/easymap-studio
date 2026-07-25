import { Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayersStore } from '@/store/layersStore'

export function PositioningPanel() {
  const requestFit = useLayersStore((s) => s.requestFit)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Adatta al preview
      </span>
      <Button variant="secondary" onClick={requestFit} className="w-full gap-2">
        <Maximize className="size-4" />
        Adatta immagine
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Ridimensiona l'immagine per riempire l'area, mantenendo le proporzioni. I 4 angoli si
        trascinano sul preview per l'allineamento fine.
      </p>
    </div>
  )
}
