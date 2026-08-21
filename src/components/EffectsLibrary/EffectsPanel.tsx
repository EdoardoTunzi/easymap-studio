import {
  Link2,
  CheckSquare,
  Square,
  Dices,
  ChevronLeft,
  ChevronRight,
  Repeat,
  RotateCcw,
  Power,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { ShaderPicker } from './ShaderPicker'
import { AudioInputPanel } from './AudioInputPanel'
import { OscilloscopePresets } from './OscilloscopePresets'
import { OSCILLOSCOPE_SHADER } from '@/lib/oscilloscopePresets'
import { SHADER_CATEGORIES } from '@/lib/shaderCategories'
import { cn } from '@/lib/utils'
import { useEffectsStore } from '@/store/effectsStore'
import { ALT_LABEL } from '@/hooks/use-effect-hotkeys'
import { useLayersStore } from '@/store/layersStore'
import {
  useUiStore,
  MIN_PALETTE_LOOP_INTERVAL,
  MAX_PALETTE_LOOP_INTERVAL,
} from '@/store/uiStore'
import { rgbToHex, hexToRgb, randomPaletteColors } from '@/store/paletteStore'

export function EffectsPanel() {
  const shaders = useEffectsStore((s) => s.shaders)
  const layers = useLayersStore((s) => s.layers)
  const activeLayerId = useLayersStore((s) => s.activeLayerId)
  const activeLayer = layers.find((l) => l.id === activeLayerId)
  const setActiveShader = useLayersStore((s) => s.setActiveShader)
  const cycleActiveShader = useLayersStore((s) => s.cycleActiveShader)
  const randomizeActiveParams = useLayersStore((s) => s.randomizeActiveParams)
  const resetActiveParams = useLayersStore((s) => s.resetActiveParams)
  const setSize = useLayersStore((s) => s.setActiveSize)
  const setParam = useLayersStore((s) => s.setActiveParam)
  const setColorParam = useLayersStore((s) => s.setActiveColorParam)
  const setPaletteColors = useLayersStore((s) => s.setPaletteColors)
  const setPaletteEnabled = useLayersStore((s) => s.setPaletteEnabled)
  const paletteEnabled = activeLayer?.palette.enabled ?? false
  const paletteCount = activeLayer?.palette.count ?? 5
  const syncTargetIds = useLayersStore((s) => s.syncTargetIds)
  const toggleSyncTarget = useLayersStore((s) => s.toggleSyncTarget)
  const setSyncAll = useLayersStore((s) => s.setSyncAll)
  const paletteLoopLayerIds = useUiStore((s) => s.paletteLoopLayerIds)
  const togglePaletteLoopFor = useUiStore((s) => s.togglePaletteLoopFor)
  const stopPaletteLoopFor = useUiStore((s) => s.stopPaletteLoopFor)
  const shaderCategory = useUiStore((s) => s.shaderCategory)
  const paletteLoopIntervals = useUiStore((s) => s.paletteLoopIntervals)
  const defaultLoopInterval = useUiStore((s) => s.paletteLoopInterval)
  const setPaletteLoopIntervalFor = useUiStore((s) => s.setPaletteLoopIntervalFor)

  // "tutti sincronizzati" se ogni layer diverso dall'attivo è spuntato
  const others = layers.filter((l) => l.id !== activeLayerId)
  const allSynced = others.length > 0 && others.every((l) => syncTargetIds.includes(l.id))

  // il loop delle palette è una proprietà del singolo layer: pulsante e intervallo riflettono e
  // modificano soltanto quello selezionato (i layer non ancora accesi partono dall'ultimo tempo usato)
  const paletteLoop = paletteLoopLayerIds.includes(activeLayerId)
  const paletteLoopInterval = paletteLoopIntervals[activeLayerId] ?? defaultLoopInterval

  // frecce e scorciatoie scorrono dentro la famiglia filtrata: il tooltip lo dice, così non
  // sembra che manchino effetti quando un filtro è attivo
  const categoryLabel =
    shaderCategory === 'all'
      ? ''
      : ` fra i ${SHADER_CATEGORIES.find((c) => c.id === shaderCategory)?.label ?? ''}`

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
        {/* Frecce affiancate alla select: stessa azione delle scorciatoie ⌥A/⌥S, che il tooltip
            fa scoprire senza doverle documentare altrove. */}
        {/* overflow-hidden + trigger con base 0: il Viewport di Radix ScrollArea è `display: table`
            e si dimensiona sul max-content, quindi senza questi la riga sborderebbe dal pannello
            con i nomi di effetto lunghi (il testo del trigger è nowrap, e le frecce si sommano). */}
        <div className="flex items-center gap-1.5 overflow-hidden">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => cycleActiveShader(-1)}
            title={`Effetto precedente${categoryLabel} (${ALT_LABEL}A)`}
            aria-label="Effetto precedente"
          >
            <ChevronLeft />
          </Button>
          {/* Effetto corrente sempre leggibile anche quando la lista è filtrata o scorsa altrove.
              I nomi lunghi finiscono in ellissi invece di essere tagliati di netto. */}
          <div
            className="flex h-9 w-0 min-w-0 flex-1 items-center rounded-md border border-border px-3 text-sm"
            title={activeShaderName}
          >
            <span className="truncate">{activeShaderName}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => cycleActiveShader(1)}
            title={`Effetto successivo${categoryLabel} (${ALT_LABEL}S)`}
            aria-label="Effetto successivo"
          >
            <ChevronRight />
          </Button>
        </div>
        <ShaderPicker value={activeShaderName} onChange={setActiveShader} />
        {/* solo per gli effetti che leggono l'audio: altrove sarebbe un controllo inerte */}
        {shader?.usesAudio && <AudioInputPanel />}
        {/* forme pronte: scorciatoie ai parametri dell'oscilloscopio, non una funzione generale */}
        {activeShaderName === OSCILLOSCOPE_SHADER && <OscilloscopePresets />}
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

      {/* Colorazione rapida: la palette è una gradient map, quindi ricolora QUALSIASI effetto.
          Qui accanto all'effetto per non dover passare dal pannello Palette a ogni prova. */}
      <div className="flex flex-col gap-1.5">
        {/* Interruttore rapido della palette: spegnerla riporta l'effetto ai suoi colori nativi
            senza perdere quelli generati, che restano pronti alla riaccensione. */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Colori casuali
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !paletteEnabled
              setPaletteEnabled(next)
              // spegnendo la palette va spento anche il loop, altrimenti continuerebbe a
              // generare colori e al primo tick la riaccenderebbe da solo
              if (!next && activeLayerId) stopPaletteLoopFor(activeLayerId)
            }}
            aria-pressed={paletteEnabled}
            title={
              paletteEnabled
                ? 'Palette attiva sui colori dell\'effetto: clicca per spegnerla e tornare ai colori originali'
                : "Palette spenta: clicca per riapplicarla all'effetto"
            }
            className={cn(
              'rounded p-1 transition-colors',
              paletteEnabled
                ? 'text-emerald-400 hover:bg-accent/50'
                : 'text-muted-foreground/50 hover:bg-accent/50 hover:text-muted-foreground',
            )}
          >
            <Power className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 flex-1 gap-1.5 px-2 text-xs"
            onClick={() => setPaletteColors(randomPaletteColors(paletteCount), paletteCount)}
          >
            <Dices className="size-3.5 shrink-0" />
            <span className="truncate">Genera</span>
          </Button>
          {[2, 3, 4, 5].map((n) => (
            <Button
              key={n}
              variant={paletteCount === n ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 w-7 shrink-0 px-0 text-xs tabular-nums"
              onClick={() => setPaletteColors(randomPaletteColors(n), n)}
              title={`Palette casuale di ${n} colori`}
            >
              {n}
            </Button>
          ))}
        </div>
        {/* Loop: "Genera" che si ripete da solo, con dissolvenza fra una palette e l'altra.
            Vale per QUESTO layer (ogni layer ha il suo), l'intervallo è invece comune ed è
            modificabile in corsa, così si può andare a tempo di musica. */}
        <div className="flex items-center gap-1.5">
          <Button
            variant={paletteLoop ? 'default' : 'outline'}
            size="sm"
            className="h-7 flex-1 gap-1.5 px-2 text-xs"
            onClick={() => activeLayerId && togglePaletteLoopFor(activeLayerId)}
            title={
              paletteLoop
                ? `Loop attivo su ${activeLayer?.name ?? 'questo layer'}: la palette cambia da sola a ogni intervallo. Gli altri layer non ne sono toccati`
                : `Cambia da sola la palette di ${activeLayer?.name ?? 'questo layer'} a ogni intervallo, con dissolvenza`
            }
          >
            <Repeat className={cn('size-3.5 shrink-0', paletteLoop && 'animate-pulse')} />
            <span className="truncate">Loop</span>
          </Button>
          <Input
            type="number"
            min={MIN_PALETTE_LOOP_INTERVAL}
            max={MAX_PALETTE_LOOP_INTERVAL}
            step={0.5}
            value={paletteLoopInterval}
            onChange={(e) =>
              activeLayerId && setPaletteLoopIntervalFor(activeLayerId, Number(e.target.value))
            }
            className="h-7 w-14 shrink-0 px-2 text-xs tabular-nums"
            aria-label={`Intervallo del loop palette di ${activeLayer?.name ?? 'questo layer'} (secondi)`}
            title={`Ogni quanti secondi cambia la palette di ${activeLayer?.name ?? 'questo layer'}. Ogni layer ha il suo tempo`}
          />
          <span className="shrink-0 text-xs text-muted-foreground">s</span>
        </div>
      </div>

      {shader && (shader.controls.length > 0 || shader.colorControls.length > 0) && <Separator />}

      {/* Colori dell'effetto: uniform vec3 dello shader, modificabili col picker */}
      {shader && shader.colorControls.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Colori effetto
          </span>
          {shader.colorControls.map((cc) => {
            const value =
              activeLayer?.colorParams[shader.name]?.[cc.name] ?? cc.default
            return (
              <div key={cc.name} className="flex items-center justify-between gap-2">
                <span className="text-xs text-foreground">{cc.name}</span>
                <label
                  className="relative h-7 w-16 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
                  style={{ background: rgbToHex(value) }}
                >
                  <input
                    type="color"
                    value={rgbToHex(value)}
                    onChange={(e) => setColorParam(cc.name, hexToRgb(e.target.value))}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              </div>
            )
          })}
        </div>
      )}

      {shader && (shader.controls.length > 0 || shader.colorControls.length > 0) && (
        <div className="flex flex-col gap-4">
          {/* Il random pesca dentro il range dichiarato da ogni uniform (@min/@max): è il modo
              più rapido di far emergere look che a mano non si proverebbero. Il reset è la via
              di ritorno: dopo qualche giro di random e ritocchi, riporta l'effetto al punto noto. */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Controlli effetto
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={resetActiveParams}
                title="Riporta controlli e colori di questo effetto ai valori di partenza (Size, palette e controlli globali non vengono toccati)"
              >
                <RotateCcw className="size-3.5 shrink-0" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs"
                onClick={randomizeActiveParams}
                title="Valori casuali per tutti i controlli di questo effetto"
              >
                <Dices className="size-3.5 shrink-0" />
                Random
              </Button>
            </div>
          </div>
          {shader.controls.map((control) => {
            const value = params[shader.name]?.[control.name] ?? control.default
            // min 0, max 1, step 1: non è uno slider continuo ma un on/off (es. i toggle
            // "mirror" dei Halo) — un bottone comunica lo stato molto meglio di uno slider.
            // `@options a|b|c`: il valore non è una quantità ma una scelta fra modi, e uno
            // slider a scatti costringerebbe a indovinare cosa significhi "1" durante un live
            if (control.options && control.options.length > 1) {
              const stepSize = control.step ?? 1
              return (
                <div key={control.name} className="flex flex-col gap-1.5">
                  <span className="text-xs text-foreground">{control.name}</span>
                  <div className="flex flex-wrap gap-1">
                    {control.options.map((label, i) => {
                      const optionValue = control.min + i * stepSize
                      const selected = Math.abs(value - optionValue) < stepSize / 2
                      return (
                        <Button
                          key={label}
                          variant={selected ? 'default' : 'outline'}
                          size="sm"
                          className="h-7 flex-1 px-2 text-xs"
                          onClick={() => setParam(control.name, optionValue)}
                        >
                          {label}
                        </Button>
                      )
                    })}
                  </div>
                </div>
              )
            }
            const isToggle = control.step === 1 && control.min === 0 && control.max === 1
            if (isToggle) {
              const on = value >= 0.5
              return (
                <Button
                  key={control.name}
                  variant={on ? 'default' : 'outline'}
                  size="sm"
                  className="justify-between gap-2 px-3 text-xs capitalize"
                  onClick={() => setParam(control.name, on ? 0 : 1)}
                >
                  {control.name}
                  <Power className="size-3.5 shrink-0" />
                </Button>
              )
            }
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
                  step={control.step ?? ((control.max - control.min) / 200 || 0.01)}
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
