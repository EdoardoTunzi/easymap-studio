import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLayersStore, BLEND_MODES, type BlendMode } from "@/store/layersStore";

/** Proprietà di mixing del layer selezionato: nome, opacità, blend mode. */
export function LayerProperties() {
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId));
  const renameLayer = useLayersStore((s) => s.renameLayer);
  const setLayerOpacity = useLayersStore((s) => s.setLayerOpacity);
  const setLayerBlendMode = useLayersStore((s) => s.setLayerBlendMode);

  if (!activeLayer) return null;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs text-muted-foreground">Nome layer</span>
      <Input
        value={activeLayer.name}
        onChange={(e) => renameLayer(activeLayer.id, e.target.value)}
        className="h-8"
        aria-label="Nome layer"
        placeholder="Nome layer"
      />

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Opacità</span>
          <span className="text-xs tabular-nums text-muted-foreground">{Math.round(activeLayer.opacity * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[activeLayer.opacity]} onValueChange={([v]) => setLayerOpacity(activeLayer.id, v)} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Blend mode</span>
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
    </div>
  );
}
