import type { ReactNode } from "react";
import { ZoomIn, ZoomOut, RotateCcw, HelpCircle, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLayersStore, BLEND_MODES, type BlendMode } from "@/store/layersStore";
import { DEFAULT_TRANSFORM } from "@/store/projectStore";
import { LENS_LIMIT } from "@/lib/warp";

const ZOOM_MIN = 0.1;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.05;

/**
 * Riga di un controllo continuo: etichetta a sinistra, valore corrente sulla stessa riga, comando
 * sotto. Un solo componente per tutte e quattro (§16 Craft: ciò che si somiglia si comporta uguale).
 */
function ControlRow({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="ui-sublabel flex items-center gap-1.5 text-muted-foreground">
          {label}
          {/* §16 (Simplicity): il percorso comune resta visibile, il contesto sta un livello più in
              là. Le note stampate sotto ogni slider occupavano più spazio dei controlli stessi.
              Il trigger è un button, così la spiegazione si raggiunge anche da tastiera. */}
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Cos'è "${label}"`}
                  className="inline-flex cursor-help items-center text-muted-foreground/40 transition-colors duration-[--dur-fast] hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-64 leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        <span className="ui-value shrink-0 text-foreground/80">{value}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * Tutto ciò che si regola con un valore, per il layer selezionato: identità (nome, blend mode) e
 * poi i quattro cursori, in fila sotto la select.
 *
 * Qui confluiscono anche i cursori che stavano altrove: Dimensione, Curvatura obiettivo e Sfumatura
 * bordi arrivano dalla ex sezione "Posizione", Rimuovi sfondo scuro e Nitidezza bordo da "Sorgente" —
 * dove erano proprietà del layer finite in mezzo al caricamento del media.
 *
 * La ex "Posizione" aveva, oltre a quei cursori, un
 * pad di frecce per spostare la proiezione. Le frecce sono sparite perché la posizione si dà
 * direttamente sul canvas trascinando il corner-pin — un pad che muove a passi di 0.05 è il modo
 * lento di fare una cosa che il gesto diretto fa meglio (§2 della skill apple-design). Quel che
 * resta sono valori continui, e il loro posto naturale è qui insieme all'opacità.
 */
export function LayerProperties() {
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId));
  const renameLayer = useLayersStore((s) => s.renameLayer);
  const setLayerOpacity = useLayersStore((s) => s.setLayerOpacity);
  const setLayerBlendMode = useLayersStore((s) => s.setLayerBlendMode);
  const setTransform = useLayersStore((s) => s.setActiveTransform);
  const setLens = useLayersStore((s) => s.setActiveLens);
  const setLumaKey = useLayersStore((s) => s.setActiveLumaKey);
  const setEdgeSharp = useLayersStore((s) => s.setActiveEdgeSharp);
  const setFeather = useLayersStore((s) => s.setActiveEdgeFeather);

  if (!activeLayer) return null;

  const transform = activeLayer.transform ?? DEFAULT_TRANSFORM;
  const lens = activeLayer.warp?.lens ?? 0;
  const feather = activeLayer.edgeFeather ?? 0;
  const lumaKey = activeLayer.lumaKey ?? 0;
  const edgeSharp = activeLayer.edgeSharp ?? 0;
  const locked = activeLayer.locked ?? false;

  const changeZoom = (delta: number) =>
    setTransform({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, transform.zoom + delta)) });

  /**
   * Il pan della proiezione si dava solo col pad direzionale, che non esiste più: un progetto
   * salvato prima resterebbe spostato senza più un modo per rimetterlo al centro, e il Reset qui
   * accanto tocca soltanto la dimensione. Questo comando compare unicamente in quel caso — sui
   * progetti nuovi l'offset è sempre 0 e la riga non si vede mai (§16, forgiveness senza rumore).
   */
  const offCenter = transform.offsetX !== 0 || transform.offsetY !== 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className="ui-sublabel text-muted-foreground">Nome layer</span>
        <Input
          value={activeLayer.name}
          onChange={(e) => renameLayer(activeLayer.id, e.target.value)}
          className="h-8"
          aria-label="Nome layer"
          placeholder="Nome layer"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="ui-sublabel text-muted-foreground">Blend mode</span>
        <Select value={activeLayer.blendMode} onValueChange={(v) => setLayerBlendMode(activeLayer.id, v as BlendMode)}>
          <SelectTrigger className="h-8 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((b) => (
              <SelectItem key={b.value} value={b.value}>
                {b.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ControlRow
        label="Dimensione"
        value={`${transform.zoom.toFixed(2)}×`}
        hint="Ridimensiona l'intera proiezione. Per spostarla o deformarne i singoli angoli, trascina il corner-pin direttamente sul preview."
      >
        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="icon-sm"
            className="press"
            onClick={() => changeZoom(-ZOOM_STEP)}
            disabled={transform.zoom <= ZOOM_MIN}
            aria-label="Riduci dimensione"
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
            aria-label="Dimensione della proiezione"
          />
          <Button
            variant="outline"
            size="icon-sm"
            className="press"
            onClick={() => changeZoom(ZOOM_STEP)}
            disabled={transform.zoom >= ZOOM_MAX}
            aria-label="Aumenta dimensione"
          >
            <ZoomIn className="size-3.5" />
          </Button>
        </div>
        {/* riporta solo la dimensione: la posizione si è data sul canvas e non va persa per un
            pulsante che sta sotto un'altra etichetta (§16, mapping fra comando e ciò che tocca) */}
        <Button
          variant="outline"
          size="sm"
          className="press w-full gap-1.5"
          onClick={() => setTransform({ zoom: DEFAULT_TRANSFORM.zoom })}
          disabled={transform.zoom === DEFAULT_TRANSFORM.zoom}
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
        {offCenter && (
          <Button
            variant="outline"
            size="sm"
            className="press w-full gap-1.5"
            onClick={() => setTransform({ offsetX: 0, offsetY: 0 })}
            title="Questo layer è stato spostato con il vecchio pad direzionale"
          >
            <Crosshair className="size-3.5" />
            Ricentra la proiezione
          </Button>
        )}
      </ControlRow>

      <ControlRow label="Opacità" value={`${Math.round(activeLayer.opacity * 100)}%`}>
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[activeLayer.opacity]}
          onValueChange={([v]) => setLayerOpacity(activeLayer.id, v)}
          aria-label="Opacità del layer"
        />
      </ControlRow>


      <ControlRow
        label="Rimuovi sfondo scuro"
        value={lumaKey <= 0 ? "off" : lumaKey.toFixed(2)}
        hint="Se l'immagine ha lo sfondo nero (non trasparente), alza questo valore per far vedere l'effetto solo sul soggetto. Con un PNG già scontornato lascia su “off”."
      >
        <Slider
          min={0}
          max={0.6}
          step={0.01}
          value={[lumaKey]}
          onValueChange={([v]) => setLumaKey(v)}
          aria-label="Rimozione dello sfondo scuro"
        />
      </ControlRow>

      <ControlRow
        label="Nitidezza bordo"
        value={edgeSharp <= 0 ? "off" : edgeSharp.toFixed(2)}
        hint="Il contorno del PNG viene ingrandito dal mapping e sull'oggetto arriva sfumato. Alza per renderlo netto: utile quando l'effetto deve fermarsi esattamente sullo spigolo. Troppo alto scaletta il bordo, il supersampling nel pannello Output lo compensa."
      >
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[edgeSharp]}
          onValueChange={([v]) => setEdgeSharp(v)}
          aria-label="Nitidezza del bordo della sagoma"
        />
      </ControlRow>

      <ControlRow
        label="Curvatura obiettivo"
        value={`${lens > 0 ? "+" : ""}${lens.toFixed(2)}`}
        hint="Corregge la distorsione dell'ottica: a sinistra i bordi si gonfiano (barile), a destra rientrano (cuscino). I 4 angoli restano fermi, quindi l'allineamento non si perde."
      >
        <Slider
          min={-LENS_LIMIT}
          max={LENS_LIMIT}
          step={0.01}
          value={[lens]}
          onValueChange={([v]) => setLens(v)}
          disabled={locked}
          aria-label="Curvatura dell'obiettivo"
        />
      </ControlRow>

      <ControlRow
        label="Sfumatura bordi"
        value={feather === 0 ? "off" : feather.toFixed(2)}
        hint="Sfuma il perimetro della proiezione invece di tagliarlo di netto: la luce muore gradualmente sull'oggetto, e due proiettori affiancati si fondono senza una riga in mezzo."
      >
        <Slider
          min={0}
          max={0.5}
          step={0.01}
          value={[feather]}
          onValueChange={([v]) => setFeather(v)}
          aria-label="Sfumatura dei bordi della proiezione"
        />
      </ControlRow>
    </div>
  );
}
