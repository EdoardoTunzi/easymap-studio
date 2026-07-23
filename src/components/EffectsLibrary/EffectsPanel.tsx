import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useEffectsStore } from '@/store/effectsStore'

export function EffectsPanel() {
  const shaders = useEffectsStore((s) => s.shaders)
  const activeShaderName = useEffectsStore((s) => s.activeShaderName)
  const setActiveShader = useEffectsStore((s) => s.setActiveShader)
  const size = useEffectsStore((s) => s.size)
  const setSize = useEffectsStore((s) => s.setSize)
  const params = useEffectsStore((s) => s.params)
  const setParam = useEffectsStore((s) => s.setParam)

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
                  onValueChange={([v]) => setParam(shader.name, control.name, v)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
