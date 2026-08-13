import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LayerList } from './LayerList'
import { LayerProperties } from './LayerProperties'
import { CollapsibleSection } from './CollapsibleSection'
import { MediaUploader } from '@/components/ControlPanel/MediaUploader'
import { BackgroundKeyPanel } from '@/components/Positioning/BackgroundKeyPanel'
import { PositioningPanel } from '@/components/Positioning/PositioningPanel'
import { MaskPanel } from '@/components/Mask/MaskPanel'
import { MovePanel } from '@/components/Positioning/MovePanel'
import { useLayersStore } from '@/store/layersStore'

/**
 * Colonna destra: tutto ciò che riguarda il layer selezionato, leggibile in un colpo d'occhio.
 * La lista dei layer resta fissa in alto perché è la selezione a comandare il contenuto di ogni
 * blocco sottostante; contenuto, maschere e posizione scorrono sotto e si possono richiudere.
 */
export function LayerInspector() {
  const maskCount = useLayersStore((s) => {
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    return (layer?.masks.length ?? 0) + (layer?.maskImage ? 1 : 0)
  })
  const hasMedia = useLayersStore(
    (s) => s.layers.find((l) => l.id === s.activeLayerId)?.media != null,
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center border-b border-sidebar-border px-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
          Layer
        </span>
      </div>

      {/* blocco fisso: la selezione non deve mai uscire dallo schermo mentre si scorre il resto */}
      <div className="shrink-0 border-b border-sidebar-border p-4">
        <LayerList />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <CollapsibleSection section="properties" title="Proprietà">
          <LayerProperties />
        </CollapsibleSection>

        <CollapsibleSection
          section="asset"
          title="Asset"
          badge={
            !hasMedia && (
              <span className="text-[10px] uppercase text-muted-foreground/70">vuoto</span>
            )
          }
        >
          <div className="flex flex-col gap-4">
            <MediaUploader />
            <Separator />
            <BackgroundKeyPanel />
            <Separator />
            <PositioningPanel />
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          section="mask"
          title="Mask"
          badge={
            maskCount > 0 && (
              <span className="rounded bg-accent px-1.5 text-[10px] tabular-nums text-accent-foreground">
                {maskCount}
              </span>
            )
          }
        >
          <MaskPanel />
        </CollapsibleSection>

        <CollapsibleSection section="move" title="Move">
          <MovePanel />
        </CollapsibleSection>
      </ScrollArea>
    </div>
  )
}
