import { Pencil, Trash2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useGenerativeStore } from '@/store/generativeStore'
import { effectThumbnail } from '@/engine/effectThumbnail'
import { createDefaultPalette } from '@/store/paletteStore'
import type { GenerativeVisual } from '@/lib/persistence'

interface GenerativeLibraryProps {
  visuals: GenerativeVisual[]
  onLoad: (visual: GenerativeVisual) => void
  onDuplicate: (visual: GenerativeVisual) => void
  onDelete: (visual: GenerativeVisual) => void
}

/** Thumbnail dello shader del visual: riusa il renderer offscreen delle card della playlist. */
function VisualThumb({ name }: { name: string }) {
  const url = effectThumbnail({
    shaderName: name,
    params: {},
    colors: {},
    size: 1,
    palette: createDefaultPalette(),
  })
  return (
    <div className="h-9 w-16 shrink-0 overflow-hidden rounded border border-border bg-black">
      {url && <img src={url} alt="" className="size-full object-cover" />}
    </div>
  )
}

export function GenerativeLibrary({
  visuals,
  onLoad,
  onDuplicate,
  onDelete,
}: GenerativeLibraryProps) {
  const editingId = useGenerativeStore((s) => s.editingId)

  if (visuals.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
        Nessun visual salvato. Componi un effetto e premi "Salva".
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-1">
      {visuals.map((visual) => (
        <li
          key={visual.id}
          className={cn(
            'flex items-center gap-2 rounded-md border px-1.5 py-1.5 transition-colors',
            visual.id === editingId
              ? 'border-primary/60 bg-accent/40'
              : 'border-border hover:bg-accent/30',
          )}
        >
          <VisualThumb name={visual.name} />
          <span className="min-w-0 flex-1 truncate text-xs">{visual.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={() => onLoad(visual)}
            aria-label={`Modifica ${visual.name}`}
            title="Apri nell'editor"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={() => onDuplicate(visual)}
            aria-label={`Duplica ${visual.name}`}
            title="Duplica"
          >
            <Copy className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(visual)}
            aria-label={`Elimina ${visual.name}`}
            title="Elimina"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
