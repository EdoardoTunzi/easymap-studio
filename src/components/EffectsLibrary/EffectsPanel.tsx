import { Link2, CheckSquare, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { useEffectsStore } from '@/store/effectsStore'
import { useLayersStore } from '@/store/layersStore'

export function EffectsPanel() {
  const shaders = useEffectsStore((s) => s.shaders)
  const layers = useLayersStore((s) => s.layers)
  const activeLayerId = useLayersStore((s) => s.activeLayerId)
  const activeLayer = layers.find((l) => l.id === activeLayerId)
  const setActiveShader = useLayersStore((s) => s.setActiveShader)
  const setSize = useLayersStore((s) => s.setActiveSize)
  const setParam = useLayersStore((s) => s.setActiveParam)
  const syncTargetIds = useLayersStore((s) => s.syncTargetIds)
  const toggleSyncTarget = useLayersStore((s) => s.toggleSyncTarget)
  const setSyncAll = useLayersStore((s) => s.setSyncAll)

  // "tutti sincronizzati" se ogni layer diverso dall'attivo è spuntato
  const others = layers.filter((l) => l.id !== activeLayerId)
  const allSynced = others.length > 0 && others.every((l) => syncTargetIds.includes(l.id))

  const activeShaderName = activeLayer?.shaderName ?? ''
  const size = activeLayer?.size ?? 1
  const params = activeLayer?.params ?? {}
  const shader = shaders.find((s) => s.name === activeShaderName)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Effetto
        </span>
        <Select value={activeShaderName} onValueChange={setActiveShader}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shaders.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {layers.length > 1 && (
          <div className="flex flex-col gap-2">
            <Button
              variant={allSynced ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSyncAll(!allSynced)}
              className="gap-1.5"
            >
              <Link2 className="size-3.5" />
              {allSynced ? 'Rendi layer indipendenti' : 'Applica a tutti i layer'}
            </Button>
            {/* Riquadro sempre visibile: spuntare un layer gli applica subito l'effetto del layer
                attivo e lo tiene sincronizzato ai successivi edit. La selezione persiste. */}
            <div className="flex flex-col gap-0.5 rounded-md border border-border p-2">
              <span className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Applica l'effetto a
              </span>
              {layers.map((l) => {
                const isSource = l.id === activeLayerId
                const checked = syncTargetIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    disabled={isSource}
                    onClick={() => toggleSyncTarget(l.id)}
                    className={cn(
                      'flex items-center gap-2 rounded px-1.5 py-1 text-left text-sm transition-colors',
                      isSource ? 'cursor-default text-muted-foreground/70' : 'hover:bg-accent/50',
                    )}
                  >
                    {isSource ? (
                      <Square className="size-4 shrink-0 text-muted-foreground/40" />
                    ) : checked ? (
                      <CheckSquare className="size-4 shrink-0 text-primary" />
                    ) : (
                      <Square className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">
                      {l.name}
                      {isSource && ' (sorgente)'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Size globale: vale per qualunque effetto, indipendente dagli uniform del singolo shader */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Size
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{size.toFixed(2)}×</span>
        </div>
        <Slider
          min={0.1}
          max={4}
          step={0.01}
          value={[size]}
          onValueChange={([v]) => setSize(v)}
        />
      </div>

      {shader && shader.controls.length > 0 && <Separator />}

      {shader && (
        <div className="flex flex-col gap-4">
          {shader.controls.map((control) => {
            const value = params[shader.name]?.[control.name] ?? control.default
            return (
              <div key={control.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-foreground">{control.name}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {value.toFixed(2)}
                  </span>
                </div>
                <Slider
                  min={control.min}
                  max={control.max}
                  step={(control.max - control.min) / 200 || 0.01}
                  value={[value]}
                  onValueChange={([v]) => setParam(control.name, v)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
