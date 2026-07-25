import { useRef, useState } from 'react'
import { Eye, EyeOff, Plus, Copy, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useLayersStore, BLEND_MODES, type BlendMode } from '@/store/layersStore'

export function LayersPanel() {
  const layers = useLayersStore((s) => s.layers)
  const activeLayerId = useLayersStore((s) => s.activeLayerId)
  const selectLayer = useLayersStore((s) => s.selectLayer)
  const addLayer = useLayersStore((s) => s.addLayer)
  const removeLayer = useLayersStore((s) => s.removeLayer)
  const duplicateLayer = useLayersStore((s) => s.duplicateLayer)
  const reorderLayers = useLayersStore((s) => s.reorderLayers)
  const renameLayer = useLayersStore((s) => s.renameLayer)
  const setLayerVisible = useLayersStore((s) => s.setLayerVisible)
  const setLayerOpacity = useLayersStore((s) => s.setLayerOpacity)
  const setLayerBlendMode = useLayersStore((s) => s.setLayerBlendMode)

  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  // La lista si mostra dall'alto (in primo piano) verso il basso (sfondo): l'ultimo layer
  // dell'array è il topmost. displayIndex 0 = topmost.
  const display = [...layers].reverse()
  const toArrayIndex = (displayIndex: number) => layers.length - 1 - displayIndex

  const activeLayer = layers.find((l) => l.id === activeLayerId)

  const handleDrop = (displayTo: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    setDragOver(null)
    if (from == null || from === displayTo) return
    reorderLayers(toArrayIndex(from), toArrayIndex(displayTo))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Layers
        </span>
        <Button variant="secondary" size="sm" className="h-7 gap-1.5" onClick={() => addLayer()}>
          <Plus className="size-3.5" />
          Nuovo
        </Button>
      </div>

      <ul className="flex flex-col gap-1">
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

      {activeLayer && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Layer attivo
            </span>

            <Input
              value={activeLayer.name}
              onChange={(e) => renameLayer(activeLayer.id, e.target.value)}
              className="h-8"
              aria-label="Nome layer"
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Opacità</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {Math.round(activeLayer.opacity * 100)}%
                </span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={[activeLayer.opacity]}
                onValueChange={([v]) => setLayerOpacity(activeLayer.id, v)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">Blend mode</span>
              <Select
                value={activeLayer.blendMode}
                onValueChange={(v) => setLayerBlendMode(activeLayer.id, v as BlendMode)}
              >
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
        </>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Trascina i layer per riordinarli. Il layer in cima alla lista è in primo piano. Seleziona un
        layer per modificarne effetto, palette, posizione e maschera.
      </p>
    </div>
  )
}
