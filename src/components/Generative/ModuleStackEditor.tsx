import { useRef, useState } from 'react'
import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useGenerativeStore } from '@/store/generativeStore'
import {
  GENERATIVE_MODULES,
  MODULE_BLEND_MODES,
  getModuleDef,
  type ModuleBlendMode,
  type ModuleInstance,
} from '@/engine/generativeModules'
import { rgbToHex, hexToRgb } from '@/store/paletteStore'

function ModuleCard({ instance, index }: { instance: ModuleInstance; index: number }) {
  const def = getModuleDef(instance.moduleId)
  const removeModule = useGenerativeStore((s) => s.removeModule)
  const setModuleParam = useGenerativeStore((s) => s.setModuleParam)
  const setModuleColorParam = useGenerativeStore((s) => s.setModuleColorParam)
  const setModuleWeight = useGenerativeStore((s) => s.setModuleWeight)
  const setModuleBlendMode = useGenerativeStore((s) => s.setModuleBlendMode)
  const [collapsed, setCollapsed] = useState(false)

  if (!def) return null

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-border bg-card/40 p-2.5">
      <div className="flex items-center gap-1.5">
        <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/50" />
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-sm font-medium">{def.label}</span>
          <span className="block truncate text-[11px] text-muted-foreground">
            {index === 0 ? 'base' : MODULE_BLEND_MODES.find((b) => b.value === instance.blendMode)?.label}
          </span>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => removeModule(instance.instanceId)}
          aria-label={`Rimuovi ${def.label}`}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {!collapsed && (
        <>
          <p className="text-[11px] leading-snug text-muted-foreground">{def.description}</p>

          {/* Il primo modulo parte da nero: blend e peso governano solo come si sovrappone ai precedenti */}
          {index > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={instance.blendMode}
                onValueChange={(v) => setModuleBlendMode(instance.instanceId, v as ModuleBlendMode)}
              >
                <SelectTrigger className="h-7 flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODULE_BLEND_MODES.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Peso</span>
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {instance.weight.toFixed(2)}
              </span>
            </div>
            <Slider
              min={0}
              max={1}
              step={0.01}
              value={[instance.weight]}
              onValueChange={([v]) => setModuleWeight(instance.instanceId, v)}
            />
          </div>

          {def.colorControls.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {def.colorControls.map((cc) => {
                const value = instance.colorParams[cc.name] ?? cc.default
                return (
                  <div key={cc.name} className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">{cc.label}</span>
                    <label
                      className="relative h-6 w-14 shrink-0 cursor-pointer overflow-hidden rounded border border-border"
                      style={{ background: rgbToHex(value) }}
                    >
                      <input
                        type="color"
                        value={rgbToHex(value)}
                        onChange={(e) =>
                          setModuleColorParam(instance.instanceId, cc.name, hexToRgb(e.target.value))
                        }
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                    </label>
                  </div>
                )
              })}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            {def.controls.map((control) => {
              const value = instance.params[control.name] ?? control.default
              return (
                <div key={control.name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{control.label}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {value.toFixed(2)}
                    </span>
                  </div>
                  <Slider
                    min={control.min}
                    max={control.max}
                    step={(control.max - control.min) / 200 || 0.01}
                    value={[value]}
                    onValueChange={([v]) => setModuleParam(instance.instanceId, control.name, v)}
                  />
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export function ModuleStackEditor() {
  const stack = useGenerativeStore((s) => s.stack)
  const mode = useGenerativeStore((s) => s.mode)
  const addModule = useGenerativeStore((s) => s.addModule)
  const reorderModules = useGenerativeStore((s) => s.reorderModules)
  const recomposeFromModules = useGenerativeStore((s) => s.recomposeFromModules)

  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const handleDrop = (to: number) => {
    const from = dragIndex.current
    dragIndex.current = null
    setDragOver(null)
    if (from == null || from === to) return
    reorderModules(from, to)
  }

  return (
    <div className="flex flex-col gap-3">
      {mode === 'code' && (
        <div className="flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5">
          <span className="text-[11px] leading-snug text-amber-200">
            Il GLSL è stato modificato a mano: i moduli sono congelati per non sovrascrivere il tuo
            codice.
          </span>
          <Button variant="secondary" size="sm" className="h-7" onClick={recomposeFromModules}>
            Ricomponi dai moduli
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Aggiungi modulo
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {GENERATIVE_MODULES.map((m) => (
            <Button
              key={m.id}
              variant="outline"
              size="sm"
              className="h-7 justify-start gap-1 px-2 text-[11px]"
              onClick={() => addModule(m.id)}
              title={m.description}
            >
              <Plus className="size-3 shrink-0" />
              <span className="truncate">{m.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {stack.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
          Nessun modulo. Aggiungine uno per iniziare a comporre il visual.
        </p>
      ) : (
        <ul className={cn('flex flex-col gap-2', mode === 'code' && 'pointer-events-none opacity-50')}>
          {stack.map((instance, i) => (
            <li
              key={instance.instanceId}
              draggable
              onDragStart={() => (dragIndex.current = i)}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(i)
              }}
              onDragLeave={() => setDragOver((v) => (v === i ? null : v))}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                dragIndex.current = null
                setDragOver(null)
              }}
              className={cn('rounded-md', dragOver === i && 'ring-1 ring-sidebar-ring')}
            >
              <ModuleCard instance={instance} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
