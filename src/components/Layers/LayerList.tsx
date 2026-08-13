import { useRef, useState } from 'react'
import { Eye, EyeOff, Plus, Copy, Trash2, GripVertical, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLayersStore } from '@/store/layersStore'

/**
 * Lista dei layer: è la selezione che comanda tutto il resto della colonna destra, quindi resta
 * ancorata in alto e non scorre con i blocchi sottostanti (scorre al proprio interno se i layer
 * sono molti).
 */
export function LayerList() {
  const layers = useLayersStore((s) => s.layers)
  const activeLayerId = useLayersStore((s) => s.activeLayerId)
  const selectLayer = useLayersStore((s) => s.selectLayer)
  const addLayer = useLayersStore((s) => s.addLayer)
  const removeLayer = useLayersStore((s) => s.removeLayer)
  const duplicateLayer = useLayersStore((s) => s.duplicateLayer)
  const reorderLayers = useLayersStore((s) => s.reorderLayers)
  const setLayerVisible = useLayersStore((s) => s.setLayerVisible)

  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // La lista si mostra dall'alto (in primo piano) verso il basso (sfondo): l'ultimo layer
  // dell'array è il topmost. displayIndex 0 = topmost.
  const display = [...layers].reverse()
  const toArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex

  const handleDrop = (displayTo: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    setDragOver(null)
    if (from == null || from === displayTo) return
    reorderLayers(toArrayIndex(from), toArrayIndex(displayTo))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layers
        </span>
        <Button variant="secondary" size="sm" className="h-7 gap-1.5" onClick={() => addLayer()}>
          <Plus className="size-3.5" />
          Nuovo
        </Button>
      </div>

      {/* max-h: con molti layer la lista scorre da sola invece di spingere fuori i blocchi sotto */}
      <ul className="flex max-h-52 flex-col gap-1 overflow-y-auto">
        {display.map((layer, di) => {
          const active = layer.id === activeLayerId
          return (
            <li
              key={layer.id}
              draggable
              onDragStart={() => (dragIndex.current = di)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(di)
              }}
              onDragLeave={() => setDragOver((v) => (v === di ? null : v))}
              onDrop={() => handleDrop(di)}
              onDragEnd={() => {
                dragIndex.current = null
                setDragOver(null)
              }}
              onClick={() => selectLayer(layer.id)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1.5 transition-colors',
                active ? 'border-primary bg-accent/40' : 'border-border hover:border-muted-foreground',
                dragOver === di && 'border-primary/70',
              )}
            >
              <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground active:cursor-grabbing" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLayerVisible(layer.id, !layer.visible)
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label={layer.visible ? 'Nascondi layer' : 'Mostra layer'}
              >
                {layer.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <span
                className={cn(
                  'flex-1 truncate text-sm',
                  layer.visible ? 'text-foreground' : 'text-muted-foreground line-through',
                )}
              >
                {layer.name}
              </span>
              {/* il lucchetto del mapping è uno stato che va visto senza dover selezionare il layer */}
              {layer.locked && (
                <Lock className="size-3 shrink-0 text-amber-400" aria-label="Mapping bloccato" />
              )}
              <span className="shrink-0 text-[10px] uppercase text-muted-foreground">
                {layer.shaderName ? layer.blendMode : ''}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  duplicateLayer(layer.id)
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Duplica layer"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeLayer(layer.id)
                }}
                disabled={layers.length <= 1}
                className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
                aria-label="Elimina layer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
