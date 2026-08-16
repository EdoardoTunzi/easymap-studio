import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import {
  Blend,
  Camera,
  Copy,
  Pause,
  Play,
  Plus,
  Repeat,
  Trash2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ShaderPicker } from '@/components/EffectsLibrary/ShaderPicker'
import { cn } from '@/lib/utils'
import { useEffectsStore, defaultParamsFor, defaultColorsFor } from '@/store/effectsStore'
import { useLayersStore, type EffectSnapshot } from '@/store/layersStore'
import { rgbToHex, hexToRgb, type Palette, type RGB } from '@/store/paletteStore'
import {
  usePlaylistStore,
  DEFAULT_CLIP_DURATION,
  MIN_CLIP_DURATION,
  type PlaylistClip,
} from '@/store/playlistStore'
import { listEffectPresets, type EffectPreset } from '@/lib/persistence'
import { effectThumbnail } from '@/engine/effectThumbnail'

/** Pixel per secondo nella timeline: la larghezza di un clip è proporzionale alla durata. */
const PX_PER_SEC = 18
const MIN_CLIP_PX = 72

/** Altezza della barra: ridimensionabile trascinando il bordo superiore. */
const MIN_BAR_H = 96
const MAX_BAR_H = 192
const BAR_HEIGHT_KEY = 'easyvj-playlist-height'

const clampBarHeight = (h: number) => Math.min(MAX_BAR_H, Math.max(MIN_BAR_H, h))

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) }
}

function clipToEffect(clip: PlaylistClip): EffectSnapshot {
  return {
    shaderName: clip.shaderName,
    params: { ...clip.params },
    colors: { ...(clip.colors ?? {}) },
    size: clip.size,
    palette: clip.palette,
  }
}

/** Applica il look del clip al layer attivo (+ layer spuntati), secco o in crossfade. */
function applyClip(clip: PlaylistClip, smooth: boolean) {
  useLayersStore.getState().applyEffectSnapshot(clipToEffect(clip), smooth)
}

/**
 * Motore di riproduzione (solo finestra Control): avanza il tempo del clip corrente,
 * al cambio clip applica l'effetto al layer (secco o crossfade) e anima la dissolvenza.
 */
function usePlaylistPlayback() {
  const playing = usePlaylistStore((s) => s.playing)

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let clipElapsed = 0
    /** Timestamp di inizio del crossfade in corso, null se nessuno. */
    let transitionStart: number | null = null

    // avvio: applica subito il clip corrente, secco
    {
      const s = usePlaylistStore.getState()
      const clip = s.clips[Math.min(s.currentIndex, s.clips.length - 1)]
      if (!clip) {
        s.setPlaying(false)
        return
      }
      applyClip(clip, false)
    }

    const tick = (now: number) => {
      const s = usePlaylistStore.getState()
      if (!s.playing) return
      const dt = (now - last) / 1000
      last = now
      if (s.clips.length === 0) {
        s.setPlaying(false)
        return
      }

      if (transitionStart != null) {
        const p = (now - transitionStart) / 1000 / Math.max(s.transitionDuration, 0.01)
        useLayersStore.getState().setTransitionProgress(Math.min(p, 1))
        if (p >= 1) transitionStart = null
      }

      let index = Math.min(s.currentIndex, s.clips.length - 1)
      let clip = s.clips[index]
      clipElapsed += dt

      if (clipElapsed >= clip.duration) {
        const nextIndex = index + 1
        if (nextIndex >= s.clips.length && !s.loop) {
          s.setClipProgress(1)
          s.setPlaying(false)
          return
        }
        index = nextIndex % s.clips.length
        clip = s.clips[index]
        clipElapsed = 0
        const smooth = s.transitionMode === 'smooth'
        applyClip(clip, smooth)
        if (smooth) transitionStart = now
        s.setCurrentIndex(index)
      }

      s.setClipProgress(Math.min(clipElapsed / clip.duration, 1))
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      // chiude di colpo un eventuale crossfade rimasto a metà
      useLayersStore.getState().setTransitionProgress(1)
    }
  }, [playing])
}

/** Editor del clip dentro il popover: nome, durata, shader, parametri, size. */
function ClipEditor({ clip }: { clip: PlaylistClip }) {
  const shaders = useEffectsStore((s) => s.shaders)
  const updateClip = usePlaylistStore((s) => s.updateClip)
  const duplicateClip = usePlaylistStore((s) => s.duplicateClip)
  const removeClip = usePlaylistStore((s) => s.removeClip)
  const shader = shaders.find((s) => s.name === clip.shaderName)

  // ogni modifica dall'editor viene anche applicata subito al layer come anteprima
  const patch = (p: Partial<Omit<PlaylistClip, 'id'>>) => {
    updateClip(clip.id, p)
    const updated = usePlaylistStore.getState().clips.find((c) => c.id === clip.id)
    if (updated) applyClip(updated, false)
  }

  const handleShaderChange = (shaderName: string) => {
    const next = shaders.find((s) => s.name === shaderName)
    if (!next) return
    patch({
      shaderName,
      params: defaultParamsFor(next),
      colors: defaultColorsFor(next),
      // se il nome era ancora quello di default (= nome shader), aggiornalo
      name: clip.name === clip.shaderName ? shaderName : clip.name,
    })
  }

  const handleCapture = () => {
    const layer = useLayersStore.getState().getActiveLayer()
    if (!layer) return
    patch({
      shaderName: layer.shaderName,
      params: { ...(layer.params[layer.shaderName] ?? {}) },
      colors: { ...(layer.colorParams[layer.shaderName] ?? {}) },
      size: layer.size,
      palette: clonePalette(layer.palette),
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Nome
          </span>
          <Input
            value={clip.name}
            onChange={(e) => updateClip(clip.id, { name: e.target.value })}
            className="h-8"
          />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Durata (s)
          </span>
          <Input
            type="number"
            min={MIN_CLIP_DURATION}
            step={0.5}
            value={Number(clip.duration.toFixed(1))}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (Number.isFinite(v)) updateClip(clip.id, { duration: v })
            }}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Effetto
        </span>
        {/* stessa lista scrollabile del pannello Shader: la tendina Radix, ancorata all'elemento
            selezionato, era impraticabile con un centinaio di effetti. Più bassa perché qui vive
            dentro l'editor della clip, che ha già poco spazio verticale. */}
        <ShaderPicker value={clip.shaderName} onChange={handleShaderChange} className="h-40" />
      </div>

      {/* colori dell'effetto (uniform vec3 dello shader) */}
      {shader && shader.colorControls.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Colori effetto
          </span>
          <div className="flex flex-wrap gap-2">
            {shader.colorControls.map((cc) => {
              const value = clip.colors?.[cc.name] ?? cc.default
              return (
                <label
                  key={cc.name}
                  title={cc.name}
                  className="relative h-7 w-12 cursor-pointer overflow-hidden rounded-md border border-border"
                  style={{ background: rgbToHex(value) }}
                >
                  <input
                    type="color"
                    value={rgbToHex(value)}
                    onChange={(e) =>
                      patch({ colors: { ...clip.colors, [cc.name]: hexToRgb(e.target.value) } })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-foreground">Size</span>
            <span className="text-xs tabular-nums text-muted-foreground">
              {clip.size.toFixed(2)}×
            </span>
          </div>
          <Slider
            min={0.1}
            max={4}
            step={0.01}
            value={[clip.size]}
            onValueChange={([v]) => patch({ size: v })}
          />
        </div>
        {shader?.controls.map((control) => {
          const value = clip.params[control.name] ?? control.default
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
                onValueChange={([v]) =>
                  patch({ params: { ...clip.params, [control.name]: v } })
                }
              />
            </div>
          )
        })}
      </div>

      <Separator />

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={handleCapture} className="flex-1 gap-1.5">
          <Camera className="size-3.5" />
          Cattura dal layer
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => duplicateClip(clip.id)}
          aria-label="Duplica clip"
        >
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => removeClip(clip.id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Elimina clip"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

/** Un clip nella timeline: blocco largo quanto la durata, playhead, resize, editor al click. */
function ClipBlock({
  clip,
  index,
  onDragStart,
  onDragOverIndex,
  onDrop,
  onDragEnd,
  isDragOver,
}: {
  clip: PlaylistClip
  index: number
  onDragStart: () => void
  onDragOverIndex: () => void
  onDrop: () => void
  onDragEnd: () => void
  isDragOver: boolean
}) {
  const currentIndex = usePlaylistStore((s) => s.currentIndex)
  const clipProgress = usePlaylistStore((s) => s.clipProgress)
  const playing = usePlaylistStore((s) => s.playing)
  const editingClipId = usePlaylistStore((s) => s.editingClipId)
  const setEditingClip = usePlaylistStore((s) => s.setEditingClip)
  const updateClip = usePlaylistStore((s) => s.updateClip)

  const isCurrent = index === currentIndex
  const isEditing = editingClipId === clip.id

  // thumbnail statica del look del clip, rigenerata (con cache) quando il look cambia
  const thumbKey = JSON.stringify([clip.shaderName, clip.params, clip.size, clip.palette])
  const thumb = useMemo(
    () => effectThumbnail(clipToEffect(clip)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbKey],
  )

  const handleResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startDuration = clip.duration
    const onMove = (ev: PointerEvent) => {
      const d = startDuration + (ev.clientX - startX) / PX_PER_SEC
      updateClip(clip.id, { duration: d })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <Popover
      open={isEditing}
      onOpenChange={(open) => {
        setEditingClip(open ? clip.id : null)
        // aprire l'editor mostra subito il look del clip sul layer (anteprima)
        if (open) applyClip(clip, false)
      }}
    >
      <PopoverTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          draggable
          onDragStart={onDragStart}
          onDragOver={(e) => {
            e.preventDefault()
            onDragOverIndex()
          }}
          onDrop={onDrop}
          onDragEnd={onDragEnd}
          style={{ width: Math.max(clip.duration * PX_PER_SEC, MIN_CLIP_PX) }}
          className={cn(
            'group relative flex h-full shrink-0 cursor-pointer select-none flex-col justify-between overflow-hidden rounded-md border bg-card px-2 py-1.5 text-left transition-colors',
            isCurrent ? 'border-primary/70' : 'border-border hover:border-foreground/30',
            isEditing && 'ring-2 ring-ring/60',
            isDragOver && 'border-l-4 border-l-primary',
          )}
        >
          {/* playhead: riempimento dell'avanzamento nel clip corrente */}
          {isCurrent && (playing || clipProgress > 0) && (
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-primary/15"
              style={{ width: `${clipProgress * 100}%` }}
            />
          )}
          <span className="relative truncate text-xs font-medium text-foreground">
            {clip.name}
          </span>
          {/* preview dell'effetto (frame statico renderizzato dallo shader del clip) */}
          {thumb && (
            <img
              src={thumb}
              alt=""
              draggable={false}
              className="pointer-events-none relative my-0.5 min-h-0 w-full flex-1 rounded-sm object-cover"
            />
          )}
          <div className="relative flex items-center justify-between gap-1">
            <span className="truncate text-[10px] text-muted-foreground">{clip.shaderName}</span>
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {clip.duration.toFixed(1)}s
            </span>
          </div>
          {/* maniglia di resize della durata (bordo destro) */}
          <div
            draggable={false}
            onPointerDown={handleResizeStart}
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-transparent transition-colors hover:bg-primary/40 group-hover:bg-foreground/10"
          />
        </div>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72">
        <ClipEditor clip={clip} />
      </PopoverContent>
    </Popover>
  )
}

/** Popover "+" per aggiungere un clip: da effetto della libreria o da preset salvato. */
function AddClipButton({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [presets, setPresets] = useState<EffectPreset[]>([])
  const shaders = useEffectsStore((s) => s.shaders)
  const addClipFromShader = usePlaylistStore((s) => s.addClipFromShader)
  const addClip = usePlaylistStore((s) => s.addClip)

  useEffect(() => {
    if (open) listEffectPresets().then(setPresets)
  }, [open])

  const addFromPreset = (p: EffectPreset) => {
    addClip({
      name: p.name,
      shaderName: p.shaderName,
      params: { ...p.params },
      colors: { ...(p.colors ?? {}) },
      size: p.size,
      palette: clonePalette(p.palette),
      duration: DEFAULT_CLIP_DURATION,
    })
    setOpen(false)
    onAdded()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" aria-label="Aggiungi clip" className="h-full w-9 shrink-0">
          <Plus className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-64 p-2">
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {presets.length > 0 && (
            <div className="flex flex-col gap-0.5">
              <span className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Preset salvati
              </span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addFromPreset(p)}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-accent/50"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
                    {p.shaderName}
                  </span>
                </button>
              ))}
              <Separator className="my-1" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Effetti
            </span>
            {shaders.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  addClipFromShader(s)
                  setOpen(false)
                  onAdded()
                }}
                className="rounded px-1.5 py-1 text-left text-sm hover:bg-accent/50"
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** Barra playlist in fondo alla Control page: trasporto + timeline dei clip. */
export function PlaylistBar() {
  usePlaylistPlayback()

  const clips = usePlaylistStore((s) => s.clips)
  const playing = usePlaylistStore((s) => s.playing)
  const setPlaying = usePlaylistStore((s) => s.setPlaying)
  const loop = usePlaylistStore((s) => s.loop)
  const setLoop = usePlaylistStore((s) => s.setLoop)
  const transitionMode = usePlaylistStore((s) => s.transitionMode)
  const setTransitionMode = usePlaylistStore((s) => s.setTransitionMode)
  const transitionDuration = usePlaylistStore((s) => s.transitionDuration)
  const setTransitionDuration = usePlaylistStore((s) => s.setTransitionDuration)
  const reorderClips = usePlaylistStore((s) => s.reorderClips)

  const dragIndex = useRef<number | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)

  const handleDrop = (to: number) => {
    if (dragIndex.current != null) reorderClips(dragIndex.current, to)
    dragIndex.current = null
    setDragOver(null)
  }

  // altezza della barra, ridimensionabile dal bordo superiore e persistita
  const [barHeight, setBarHeight] = useState(() =>
    clampBarHeight(Number(localStorage.getItem(BAR_HEIGHT_KEY)) || MIN_BAR_H),
  )
  const handleBarResize = (e: ReactPointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = barHeight
    let latest = startH
    const onMove = (ev: PointerEvent) => {
      latest = clampBarHeight(startH - (ev.clientY - startY))
      setBarHeight(latest)
    }
    const onUp = () => {
      localStorage.setItem(BAR_HEIGHT_KEY, String(latest))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // scroll orizzontale della timeline anche con la rotellina verticale del mouse
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      // lascia passare lo scroll orizzontale nativo di trackpad/shift+rotellina
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const scrollToEnd = () => {
    // dopo il render del nuovo clip, porta la timeline in fondo per mostrarlo
    requestAnimationFrame(() => {
      const el = scrollRef.current
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
    })
  }

  const smooth = transitionMode === 'smooth'

  return (
    <div
      style={{ height: barHeight }}
      className="relative flex shrink-0 items-stretch gap-3 border-t border-sidebar-border bg-sidebar px-3 py-2.5"
    >
      {/* maniglia di resize dell'altezza (bordo superiore) */}
      <div
        onPointerDown={handleBarResize}
        className="absolute inset-x-0 -top-1 z-10 h-2 cursor-ns-resize transition-colors hover:bg-primary/30"
      />
      {/* trasporto */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="icon"
          variant={playing ? 'default' : 'secondary'}
          onClick={() => setPlaying(!playing)}
          disabled={clips.length === 0}
          aria-label={playing ? 'Pausa' : 'Play'}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLoop(!loop)}
          aria-label="Loop"
          title={loop ? 'Loop attivo: la sequenza si ripete' : 'Loop spento: si ferma sull’ultimo clip'}
          className={cn(loop ? 'text-primary' : 'text-muted-foreground')}
        >
          <Repeat className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setTransitionMode(smooth ? 'cut' : 'smooth')}
          title={
            smooth
              ? 'Transizione smooth (crossfade): clicca per passare a secca'
              : 'Transizione secca: clicca per passare a smooth'
          }
          className="gap-1.5"
        >
          {smooth ? <Blend className="size-3.5" /> : <Zap className="size-3.5" />}
          {smooth ? 'Smooth' : 'Secca'}
        </Button>
        {smooth && (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={Number(transitionDuration.toFixed(1))}
              onChange={(e) => {
                const v = Number(e.target.value)
                if (Number.isFinite(v)) setTransitionDuration(v)
              }}
              className="h-8 w-16"
              aria-label="Durata transizione (secondi)"
            />
            <span className="text-xs text-muted-foreground">s</span>
          </div>
        )}
      </div>

      <Separator orientation="vertical" className="h-auto" />

      {/* timeline: scrollabile in orizzontale (rotellina + scrollbar visibile) */}
      <div
        ref={scrollRef}
        className="timeline-scroll flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1"
      >
        {clips.length === 0 ? (
          <p className="self-center text-xs text-muted-foreground">
            Aggiungi effetti alla sequenza con il pulsante +. Trascina il bordo destro di un clip
            per cambiarne la durata, cliccaci sopra per modificarlo.
          </p>
        ) : (
          clips.map((clip, i) => (
            <ClipBlock
              key={clip.id}
              clip={clip}
              index={i}
              isDragOver={dragOver === i}
              onDragStart={() => (dragIndex.current = i)}
              onDragOverIndex={() => setDragOver(i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                dragIndex.current = null
                setDragOver(null)
              }}
            />
          ))
        )}
      </div>

      <AddClipButton onAdded={scrollToEnd} />
    </div>
  )
}
