import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { LayerList } from "./LayerList";
import { LayerProperties } from "./LayerProperties";
import { CollapsibleSection } from "./CollapsibleSection";
import { MediaUploader } from "@/components/ControlPanel/MediaUploader";
import { CameraPicker } from "@/components/ControlPanel/CameraPicker";
import { MaskPanel } from "@/components/Mask/MaskPanel";
import { useLayersStore } from "@/store/layersStore";
import { useScrollShadow } from "@/hooks/use-scroll-shadow";

/**
 * Colonna destra: tutto ciò che riguarda il layer selezionato, leggibile in un colpo d'occhio.
 * La lista dei layer resta fissa in alto perché è la selezione a comandare il contenuto di ogni
 * blocco sottostante; contenuto, maschere e posizione scorrono sotto e si possono richiudere.
 *
 * L'intestazione porta il nome del layer attivo invece della parola "Layer": è la risposta a
 * "dove sono?" (§16 Wayfinding della skill apple-design) e toglie la ripetizione con la lista
 * appena sotto, che quella parola la diceva già.
 */
export function LayerInspector() {
  const activeName = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.name);
  const layerCount = useLayersStore((s) => s.layers.length);
  const maskCount = useLayersStore((s) => {
    const layer = s.layers.find((l) => l.id === s.activeLayerId);
    return (layer?.masks.length ?? 0) + (layer?.maskImage ? 1 : 0);
  });
  const hasMedia = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.media != null);

  // §12: dove il contenuto passa sotto la chrome si sfuma il bordo invece di piantarci una riga
  // fissa da 1px — e lo si fa solo quando c'è davvero qualcosa di nascosto sopra.
  const { ref: scrollRef, scrolled } = useScrollShadow<HTMLDivElement>();

  return (
    <div className="flex h-full flex-col">
      {/* Titolo della colonna: stesso maiuscoletto degli altri titoli (.ui-eyebrow, 11px) e stesso
          px-4 del resto, altrimenti resta l'unico testo appoggiato al bordo. */}
      <div className="shrink-0 px-4 pt-3.5 pb-2.5">
        <span className="ui-eyebrow text-muted-foreground">Layer Inspector</span>
      </div>

      {/* §15: la gerarchia si costruisce con peso + corpo + colore insieme, non con il solo corpo.
          L'etichetta sta indietro (muted, 12px), il nome del layer viene avanti (15px semibold, con
          il tracking stretto che il testo grande richiede): l'informazione è il nome, non la parola
          che lo introduce. Il divisore è la hairline usata nel resto della colonna, non il Separator
          pieno, che qui pesava più del titolo che stava separando. */}
      <div className="flex shrink-0 items-baseline justify-between gap-3 border-t border-sidebar-border/60 px-4 py-3">
        {/* min-w-0: senza, il truncate non ha effetto e un nome lungo allarga la colonna */}
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="ui-sublabel shrink-0 text-muted-foreground">Layer selezionato: </span>
          <span className="truncate text-[0.9375rem] leading-tight tracking-[-0.011em] text-sidebar-foreground">{activeName ?? "Nessun layer"}</span>
        </div>

        <span className="ui-value shrink-0 text-[11px] text-muted-foreground/70">
          {layerCount} {layerCount === 1 ? "layer" : "layers"}
        </span>
      </div>

      {/* blocco fisso: la selezione non deve mai uscire dallo schermo mentre si scorre il resto */}
      <div className="shrink-0 px-4 pb-3">
        <LayerList />
      </div>

      <div ref={scrollRef} className="relative min-h-0 flex-1">
        {/* la sfumatura vive sopra il contenuto e compare solo a scorrimento iniziato */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-sidebar to-transparent transition-opacity duration-[--dur-base] ease-[--ease-out]"
          style={{ opacity: scrolled ? 1 : 0 }}
        />
        <ScrollArea className="h-full border-t border-sidebar-border/60">
          <CollapsibleSection section="properties" title="Proprietà">
            <LayerProperties />
          </CollapsibleSection>

          <CollapsibleSection
            section="asset"
            title="Sorgente"
            badge={!hasMedia && <span className="ui-eyebrow text-[10px] text-muted-foreground/60">vuoto</span>}
          >
            <div className="flex flex-col gap-4">
              <MediaUploader />
              <Separator />
              <CameraPicker />
            </div>
          </CollapsibleSection>

          <CollapsibleSection
            section="mask"
            title="Maschere"
            badge={
              maskCount > 0 && (
                <span className="ui-value rounded-full bg-sidebar-accent px-1.5 text-[10px] leading-[1.4] text-sidebar-accent-foreground">{maskCount}</span>
              )
            }
          >
            <MaskPanel />
          </CollapsibleSection>
        </ScrollArea>
      </div>
    </div>
  );
}
