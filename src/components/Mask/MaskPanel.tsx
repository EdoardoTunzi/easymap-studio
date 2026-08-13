import { useRef } from 'react'
import { Square, Circle, Trash2, ImageUp, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useLayersStore } from '@/store/layersStore'

export function MaskPanel() {
  const maskInputRef = useRef<HTMLInputElement>(null)
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const activeMaskId = useLayersStore((s) => s.activeMaskId)
  const addMask = useLayersStore((s) => s.addMask)
  const removeMask = useLayersStore((s) => s.removeMask)
  const updateMask = useLayersStore((s) => s.updateMask)
  const selectMask = useLayersStore((s) => s.selectMask)
  const setMaskImage = useLayersStore((s) => s.setMaskImage)

  const masks = activeLayer?.masks ?? []
  const selected = masks.find((m) => m.id === activeMaskId)
  const maskImage = activeLayer?.maskImage ?? null

  const handleMaskFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setMaskImage({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        type: 'image',
        width: img.naturalWidth,
        height: img.naturalHeight,
        blob: file,
      })
    }
    img.src = url
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Forme maschera
        </span>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => addMask('rectangle')}>
            <Square className="size-3.5" />
            Rettangolo
          </Button>
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => addMask('ellipse')}>
            <Circle className="size-3.5" />
            Ellisse
          </Button>
        </div>
      </div>

      {masks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {masks.map((m, i) => (
            <li
              key={m.id}
              // toggle: le maniglie sul canvas mostrano la maschera selezionata al posto del
              // corner-pin, quindi ri-cliccarla è l'unico modo per tornare a regolare il mapping
              onClick={() => selectMask(m.id === activeMaskId ? null : m.id)}
              title={m.id === activeMaskId ? 'Clicca per deselezionare e tornare al corner-pin' : undefined}
              className={cn(
                'flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                m.id === activeMaskId
                  ? 'border-primary bg-accent/40'
                  : 'border-border hover:border-muted-foreground',
              )}
            >
              {m.type === 'ellipse' ? <Circle className="size-3.5" /> : <Square className="size-3.5" />}
              <span className="flex-1 text-sm capitalize">
                {m.type === 'ellipse' ? 'Ellisse' : 'Rettangolo'} {i + 1}
                {m.invert ? ' (invertita)' : ''}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeMask(m.id)
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Elimina maschera"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Maschera selezionata
            </span>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Sfumatura bordo</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(selected.feather * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[selected.feather]}
                onValueChange={([v]) => updateMask(selected.id, { feather: v })}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Rotazione</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round((selected.rotation * 180) / Math.PI)}°
                </span>
              </div>
              <Slider
                min={-Math.PI}
                max={Math.PI}
                step={0.01}
                value={[selected.rotation]}
                onValueChange={([v]) => updateMask(selected.id, { rotation: v })}
              />
            </div>

            <Button
              variant={selected.invert ? 'default' : 'outline'}
              size="sm"
              onClick={() => updateMask(selected.id, { invert: !selected.invert })}
            >
              {selected.invert ? 'Ritaglio: fuori dalla forma' : 'Ritaglio: dentro la forma'}
            </Button>
          </div>
        </>
      )}

      <Separator />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Maschera da immagine (stencil)
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 justify-start gap-2"
            onClick={() => maskInputRef.current?.click()}
          >
            <ImageUp className="size-4 shrink-0" />
            <span className="truncate">{maskImage ? maskImage.name : 'Carica PNG…'}</span>
          </Button>
          {maskImage && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => setMaskImage(null)}
              aria-label="Rimuovi maschera-immagine"
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <input
          ref={maskInputRef}
          type="file"
          accept="image/png,image/webp,image/jpeg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleMaskFile(file)
          }}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Le zone chiare del PNG mostrano il layer, quelle scure/trasparenti lo nascondono. Si combina
          (in AND) con le forme maschera.
        </p>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Aggiungi forme e trascinale sul preview per limitare dove il layer è visibile (es. solo le
        finestre). Più forme si sommano.
      </p>
    </div>
  )
}
