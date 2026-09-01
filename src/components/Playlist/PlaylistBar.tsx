import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Blend, Camera, Copy, MoreHorizontal, Pause, Play, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AssetPlaylistBar } from "@/components/Playlist/AssetPlaylistBar";
import { ShaderPicker } from "@/components/EffectsLibrary/ShaderPicker";
import { cn } from "@/lib/utils";
import { useEffectsStore, defaultParamsFor, defaultColorsFor } from "@/store/effectsStore";
import { useLayersStore } from "@/store/layersStore";
import { rgbToHex, hexToRgb, type Palette, type RGB } from "@/store/paletteStore";
import { usePlaylistStore, DEFAULT_CLIP_DURATION, MIN_CLIP_DURATION, type PlaylistClip } from "@/store/playlistStore";
import { applyClip, clipToEffect } from "@/hooks/use-effect-playlist";
import { useUiStore } from "@/store/uiStore";
import { listEffectPresets, type EffectPreset } from "@/lib/persistence";
import { effectThumbnail } from "@/engine/effectThumbnail";

/** Pixel per secondo nella timeline: la larghezza di un clip è proporzionale alla durata. */
const PX_PER_SEC = 18;
const MIN_CLIP_PX = 72;

/**
 * Altezza della barra: ridimensionabile trascinando il bordo superiore. I 36px in più rispetto
 * ai valori originali (96/192) sono la riga del selettore Effetti/Assets, che ora sta sopra i
 * controlli: senza, i clip perderebbero in altezza quanto occupa lei.
 */
const MIN_BAR_H = 132;
const MAX_BAR_H = 228;
const BAR_HEIGHT_KEY = "easyvj-playlist-height";
const BAR_TAB_KEY = "easyvj-playlist-tab";

const clampBarHeight = (h: number) => Math.min(MAX_BAR_H, Math.max(MIN_BAR_H, h));

/** Riferimento stabile per i layer senza playlist: un `[]` nuovo a ogni render rirenderizza sempre. */
const EMPTY_CLIPS: PlaylistClip[] = [];

/**
 * Sfuma i bordi di una lista scrollabile invece di tagliarla di netto, e solo dove c'è davvero
 * altro contenuto nascosto (§12 della skill apple-design). A differenza di `useScrollShadow`
 * (agganciato al viewport di Radix ScrollArea) questa lista è un semplice `overflow-y-auto`, e
 * serve anche il bordo basso: senza scrollbar visibile a riposo, nulla segnala che i cursori
 * continuano oltre — specie subito dopo aver cambiato effetto, quando la lista riparte dall'alto.
 */
function useEdgeScrollFade<T extends HTMLElement>(deps: readonly unknown[]) {
  const ref = useRef<T>(null);
  const [top, setTop] = useState(false);
  const [bottom, setBottom] = useState(false);

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setTop(el.scrollTop > 2);
    setBottom(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(measure);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(measure, deps);

  return { ref, top, bottom, onScroll: measure };
}

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) };
}

/** Editor del clip dentro il popover: nome, durata, shader, parametri, size. */
function ClipEditor({ clip, layerId }: { clip: PlaylistClip; layerId: string }) {
  const shaders = useEffectsStore((s) => s.shaders);
  const updateClip = usePlaylistStore((s) => s.updateClip);
  const duplicateClip = usePlaylistStore((s) => s.duplicateClip);
  const removeClip = usePlaylistStore((s) => s.removeClip);
  const shader = shaders.find((s) => s.name === clip.shaderName);

  // ogni modifica dall'editor viene anche applicata subito al layer come anteprima
  const patch = (p: Partial<Omit<PlaylistClip, "id">>) => {
    updateClip(layerId, clip.id, p);
    const updated = usePlaylistStore.getState().playlists[layerId]?.clips.find((c) => c.id === clip.id);
    if (updated) applyClip(layerId, updated, false);
  };

  const handleShaderChange = (shaderName: string) => {
    const next = shaders.find((s) => s.name === shaderName);
    if (!next) return;
    patch({
      shaderName,
      params: defaultParamsFor(next),
      colors: defaultColorsFor(next),
      // se il nome era ancora quello di default (= nome shader), aggiornalo
      name: clip.name === clip.shaderName ? shaderName : clip.name
    });
  };

  const handleCapture = () => {
    const layer = useLayersStore.getState().getActiveLayer();
    if (!layer) return;
    patch({
      shaderName: layer.shaderName,
      params: { ...(layer.params[layer.shaderName] ?? {}) },
      colors: { ...(layer.colorParams[layer.shaderName] ?? {}) },
      size: layer.size,
      palette: clonePalette(layer.palette)
    });
  };

  // il numero di cursori cambia con lo shader: la sfumatura va ricalcolata, non solo allo scroll
  const paramsFade = useEdgeScrollFade<HTMLDivElement>([shader?.controls.length ?? 0]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <span className="ui-eyebrow text-muted-foreground">Nome</span>
          <Input value={clip.name} onChange={(e) => updateClip(layerId, clip.id, { name: e.target.value })} className="h-8" />
        </div>
        <div className="flex w-20 flex-col gap-1">
          <span className="ui-eyebrow text-muted-foreground">Durata (s)</span>
          <Input
            type="number"
            min={MIN_CLIP_DURATION}
            step={0.5}
            value={Number(clip.duration.toFixed(1))}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) updateClip(layerId, clip.id, { duration: v });
            }}
            className="h-8"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="ui-eyebrow text-muted-foreground">Effetto</span>
        {/* stessa lista scrollabile del pannello Shader: la tendina Radix, ancorata all'elemento
            selezionato, era impraticabile con un centinaio di effetti. Più bassa perché qui vive
            dentro l'editor della clip, che ha già poco spazio verticale. */}
        <ShaderPicker value={clip.shaderName} onChange={handleShaderChange} className="h-40" />
      </div>

      {/* colori dell'effetto (uniform vec3 dello shader) */}
      {shader && shader.colorControls.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="ui-eyebrow text-muted-foreground">Colori effetto</span>
          <div className="flex flex-wrap gap-2">
            {shader.colorControls.map((cc) => {
              const value = clip.colors?.[cc.name] ?? cc.default;
              return (
                <label
                  key={cc.name}
                  title={cc.name}
                  className="press relative h-7 w-12 cursor-pointer overflow-hidden rounded-md border border-border transition-colors duration-[--dur-fast] ease-[--ease-out] hover:border-foreground/30"
                  style={{ background: rgbToHex(value) }}
                >
                  <input
                    type="color"
                    value={rgbToHex(value)}
                    onChange={(e) => patch({ colors: { ...clip.colors, [cc.name]: hexToRgb(e.target.value) } })}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="relative min-h-0">
        {/* sfumature invece di un taglio secco: appaiono solo mentre c'è altro contenuto oltre il
            bordo, sopra o sotto (§12) */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-4 bg-linear-to-b from-popover to-transparent transition-opacity duration-[--dur-fast] ease-[--ease-out]"
          style={{ opacity: paramsFade.top ? 1 : 0 }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-4 bg-linear-to-t from-popover to-transparent transition-opacity duration-[--dur-fast] ease-[--ease-out]"
          style={{ opacity: paramsFade.bottom ? 1 : 0 }}
        />
        <div ref={paramsFade.ref} onScroll={paramsFade.onScroll} className="flex max-h-56 flex-col gap-3 overflow-y-auto pr-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="ui-sublabel inline-block text-muted-foreground first-letter:uppercase">Size</span>
              <span className="ui-value shrink-0 text-foreground/80">{clip.size.toFixed(2)}×</span>
            </div>
            <Slider min={0.1} max={4} step={0.01} value={[clip.size]} onValueChange={([v]) => patch({ size: v })} />
          </div>
          {shader?.controls.map((control) => {
            const value = clip.params[control.name] ?? control.default;
            return (
              <div key={control.name} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="ui-sublabel inline-block text-muted-foreground first-letter:uppercase">{control.name}</span>
                  <span className="ui-value shrink-0 text-foreground/80">{value.toFixed(2)}</span>
                </div>
                <Slider
                  min={control.min}
                  max={control.max}
                  step={(control.max - control.min) / 200 || 0.01}
                  value={[value]}
                  onValueChange={([v]) => patch({ params: { ...clip.params, [control.name]: v } })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <Separator />

      <div className="flex items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={handleCapture} className="flex-1 gap-1.5">
          <Camera data-icon="inline-start" />
          Cattura dal layer
        </Button>
        <Separator orientation="vertical" className="h-5" />
        <Button variant="ghost" size="icon-sm" onClick={() => duplicateClip(layerId, clip.id)} aria-label="Duplica clip">
          <Copy className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => removeClip(layerId, clip.id)}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Elimina clip"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** Un clip nella timeline: blocco largo quanto la durata, playhead, resize, editor al click. */
function ClipBlock({
  clip,
  layerId,
  index,
  onDragStart,
  onDragOverIndex,
  onDrop,
  onDragEnd,
  isDragOver
}: {
  clip: PlaylistClip;
  layerId: string;
  index: number;
  onDragStart: () => void;
  onDragOverIndex: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
  isDragOver: boolean;
}) {
  const currentIndex = usePlaylistStore((s) => s.currentIndex[layerId] ?? 0);
  const clipProgress = usePlaylistStore((s) => s.clipProgress[layerId] ?? 0);
  const playing = usePlaylistStore((s) => s.playing[layerId] ?? false);
  const editingClipId = usePlaylistStore((s) => s.editingClipId);
  const setEditingClip = usePlaylistStore((s) => s.setEditingClip);
  const updateClip = usePlaylistStore((s) => s.updateClip);
  const removeClip = usePlaylistStore((s) => s.removeClip);

  const isCurrent = index === currentIndex;
  const isEditing = editingClipId === clip.id;

  // thumbnail statica del look del clip, rigenerata (con cache) quando il look cambia
  const thumbKey = JSON.stringify([clip.shaderName, clip.params, clip.size, clip.palette]);
  const thumb = useMemo(
    () => effectThumbnail(clipToEffect(clip)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [thumbKey]
  );

  const handleResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDuration = clip.duration;
    const onMove = (ev: PointerEvent) => {
      const d = startDuration + (ev.clientX - startX) / PX_PER_SEC;
      updateClip(layerId, clip.id, { duration: d });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverIndex();
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      style={{ width: Math.max(clip.duration * PX_PER_SEC, MIN_CLIP_PX) }}
      className={cn(
        // il clip non è più cliccabile: l'editor si apre solo dai tre puntini, così il
        // click accidentale non applica l'effetto al layer durante un live
        "group relative flex h-full shrink-0 cursor-grab select-none flex-col justify-between overflow-hidden rounded-lg border px-2 py-1.5 text-left active:cursor-grabbing",
        "transition-colors duration-[--dur-fast] ease-[--ease-out]",
        isCurrent ? "border-primary/70 bg-sidebar-accent/70" : "border-transparent bg-sidebar-accent/25 hover:bg-sidebar-accent/45",
        isEditing && "ring-2 ring-primary/50",
        isDragOver && "border-l-4 border-l-primary"
      )}
    >
      {/* playhead: riempimento dell'avanzamento nel clip corrente, con bordo d'attacco acceso
          così il transport si legge come "vivo" e non come una barra statica */}
      {isCurrent && (playing || clipProgress > 0) && (
        <div className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${clipProgress * 100}%` }}>
          {clipProgress > 0 && clipProgress < 1 && <span className="absolute inset-y-0 right-0 w-px bg-primary/70" />}
        </div>
      )}
      <span className="relative flex items-center gap-1.5 truncate">
        {isCurrent && playing && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
        <span className="ui-label truncate font-medium text-foreground">{clip.name}</span>
      </span>
      {/* preview dell'effetto (frame statico renderizzato dallo shader del clip) */}
      {thumb && (
        <img
          src={thumb}
          alt=""
          draggable={false}
          className="pointer-events-none relative my-0.5 min-h-0 w-full flex-1 rounded-md object-cover ring-1 ring-black/5 dark:ring-white/5"
        />
      )}
      <div className="relative flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-muted-foreground">{clip.shaderName}</span>
        <span className="ui-value shrink-0 text-[10px] text-muted-foreground">{clip.duration.toFixed(1)}s</span>
      </div>

      {/* azioni in hover: opzioni (tre puntini) e rimozione dalla playlist. Sempre visibili
          quando non esiste hover (touch), altrimenti resterebbero irraggiungibili (§10). */}
      <div
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
        className={cn(
          "absolute right-2 top-1.5 z-10 flex items-center gap-0.5 rounded-md bg-card/90 p-0.5 opacity-0 shadow-sm backdrop-blur-sm",
          "transition-opacity duration-[--dur-fast] ease-[--ease-out]",
          "group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
          isEditing && "opacity-100"
        )}
      >
        <Popover
          open={isEditing}
          onOpenChange={(open) => {
            setEditingClip(open ? clip.id : null);
            // aprire l'editor mostra subito il look del clip sul layer (anteprima)
            if (open) applyClip(layerId, clip, false);
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Opzioni clip"
              title="Opzioni clip"
              className="press flex size-5 items-center justify-center rounded text-muted-foreground transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-accent hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-72">
            <ClipEditor clip={clip} layerId={layerId} />
          </PopoverContent>
        </Popover>
        <button
          type="button"
          aria-label="Rimuovi dalla playlist"
          title="Rimuovi dalla playlist (l'effetto resta nella libreria)"
          onClick={() => removeClip(layerId, clip.id)}
          className="press flex size-5 items-center justify-center rounded text-muted-foreground transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-destructive/15 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* maniglia di resize della durata (bordo destro): l'area di presa è larga (§10 hit
          padding) ma il segno visivo resta un filo sottile finché non ci si passa sopra */}
      <div
        draggable={false}
        onPointerDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
        className="group/handle absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-end bg-transparent transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-primary/10"
      >
        <span className="h-5 w-px bg-foreground/10 transition-colors duration-[--dur-fast] ease-[--ease-out] group-hover:bg-foreground/20 group-hover/handle:bg-primary/70" />
      </div>
    </div>
  );
}

/** Popover "+" per aggiungere un clip: da effetto della libreria o da preset salvato. */
function AddClipButton({ onAdded, layerId }: { onAdded: () => void; layerId: string }) {
  const [open, setOpen] = useState(false);
  const [presets, setPresets] = useState<EffectPreset[]>([]);
  const shaders = useEffectsStore((s) => s.shaders);
  const addClipFromShader = usePlaylistStore((s) => s.addClipFromShader);
  const addClip = usePlaylistStore((s) => s.addClip);

  useEffect(() => {
    if (open) listEffectPresets().then(setPresets);
  }, [open]);

  const addFromPreset = (p: EffectPreset) => {
    addClip(layerId, {
      name: p.name,
      shaderName: p.shaderName,
      params: { ...p.params },
      colors: { ...(p.colors ?? {}) },
      size: p.size,
      palette: clonePalette(p.palette),
      duration: DEFAULT_CLIP_DURATION
    });
    setOpen(false);
    onAdded();
  };

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
              <span className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Preset salvati</span>
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addFromPreset(p)}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-accent/50"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{p.shaderName}</span>
                </button>
              ))}
              <Separator className="my-1" />
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <span className="px-1.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Effetti</span>
            {shaders.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => {
                  addClipFromShader(layerId, s);
                  setOpen(false);
                  onAdded();
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
  );
}

/** Barra playlist in fondo alla Control page: trasporto + timeline dei clip. */
export function PlaylistBar() {
  // entrambe le sequenze della barra sono del LAYER ATTIVO: la barra mostra quella del layer
  // selezionato, ma i motori (montati nella pagina) continuano a far girare anche le altre
  const layerId = useLayersStore((s) => s.activeLayerId);
  const layerName = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.name ?? "");

  const clips = usePlaylistStore((s) => s.playlists[layerId]?.clips ?? EMPTY_CLIPS);
  const playing = usePlaylistStore((s) => s.playing[layerId] ?? false);
  const setPlaying = usePlaylistStore((s) => s.setPlaying);
  const loop = usePlaylistStore((s) => s.playlists[layerId]?.loop ?? true);
  const setLoop = usePlaylistStore((s) => s.setLoop);
  const transitionMode = usePlaylistStore((s) => s.transitionMode);
  const setTransitionMode = usePlaylistStore((s) => s.setTransitionMode);
  const transitionDuration = usePlaylistStore((s) => s.transitionDuration);
  const setTransitionDuration = usePlaylistStore((s) => s.setTransitionDuration);
  const reorderClips = usePlaylistStore((s) => s.reorderClips);
  const playlistVisible = useUiStore((s) => s.playlistVisible);

  // due sequenze indipendenti condividono la barra, entrambe per layer: gli EFFETTI (che shader
  // gira) e gli ASSET (che contenuto scorre, da una cartella). Possono girare insieme sullo
  // stesso layer. I motori stanno nella pagina, non qui: cambiando tab questo ramo si smonta.
  const [tab, setTab] = useState<"fx" | "assets">(() => (localStorage.getItem(BAR_TAB_KEY) === "assets" ? "assets" : "fx"));

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const handleDrop = (to: number) => {
    if (dragIndex.current != null) reorderClips(layerId, dragIndex.current, to);
    dragIndex.current = null;
    setDragOver(null);
  };

  // altezza della barra, ridimensionabile dal bordo superiore e persistita
  const [barHeight, setBarHeight] = useState(() => clampBarHeight(Number(localStorage.getItem(BAR_HEIGHT_KEY)) || MIN_BAR_H));
  const handleBarResize = (e: ReactPointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = barHeight;
    let latest = startH;
    const onMove = (ev: PointerEvent) => {
      latest = clampBarHeight(startH - (ev.clientY - startY));
      setBarHeight(latest);
    };
    const onUp = () => {
      localStorage.setItem(BAR_HEIGHT_KEY, String(latest));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // scroll orizzontale della timeline anche con la rotellina verticale del mouse
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // lascia passare lo scroll orizzontale nativo di trackpad/shift+rotellina
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // cambiando tab la timeline è un altro nodo: il listener va riagganciato
  }, [tab]);

  const scrollToEnd = () => {
    // dopo il render del nuovo clip, porta la timeline in fondo per mostrarlo
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    });
  };

  const smooth = transitionMode === "smooth";

  return (
    <div
      style={{ height: barHeight }}
      className={cn(
        "relative flex shrink-0 flex-col gap-2 border-t border-sidebar-border bg-sidebar px-3 py-2.5",
        // nascosta ma montata: i motori vivono nella pagina, ma tenerla montata conserva
        // l'altezza e la posizione di scorrimento della timeline fra un'apertura e l'altra
        !playlistVisible && "hidden"
      )}
    >
      {/* maniglia di resize dell'altezza (bordo superiore): una grip pill centrale rende visibile
          da subito che il bordo si trascina, invece di lasciarlo scoprire per caso (wayfinding) */}
      <div onPointerDown={handleBarResize} className="group/vgrip absolute inset-x-0 -top-1.5 z-10 flex h-3 cursor-ns-resize items-center justify-center">
        <span className="h-1 w-9 rounded-full bg-foreground/15 transition-colors duration-[--dur-fast] ease-[--ease-out] group-hover/vgrip:bg-primary/60" />
      </div>
      {/* quale sequenza si sta preparando: gli effetti o i contenuti del layer. Sta in cima, sopra
          il proprio trasporto, perché è la scelta che governa tutta la fascia sottostante: da
          dentro la riga dei controlli si sarebbe letta come un controllo fra gli altri. */}
      <ToggleGroup
        type="single"
        value={tab}
        onValueChange={(v) => {
          if (!v) return; // click sulla voce già attiva: non si resta senza tab
          setTab(v as "fx" | "assets");
          localStorage.setItem(BAR_TAB_KEY, v);
        }}
        size="sm"
        className="shrink-0 self-start"
      >
        {/* lo stato attivo del variant (`bg-muted`) su `bg-sidebar` è a un passo di luminanza dal
            fondo: dal vivo non si legge quale sequenza si sta guardando. Si usa lo stesso segnale
            pieno della toolbar di mapping ("Tutti", "Medio"), che è inequivocabile a colpo d'occhio. */}
        {(
          [
            ["fx", "Effetti", "Playlist effetti"],
            ["assets", "Assets", "Playlist asset del layer"]
          ] as const
        ).map(([value, label, aria]) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={aria}
            className="text-muted-foreground data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {/* riga dei controlli: trasporto + timeline della sequenza scelta sopra */}
      <div className="flex min-h-0 flex-1 items-stretch gap-3">
      {tab === "assets" ? (
        <AssetPlaylistBar scrollRef={scrollRef} />
      ) : (
        <>
      {/* trasporto */}
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="icon"
          variant={playing ? "default" : "secondary"}
          onClick={() => setPlaying(layerId, !playing)}
          disabled={clips.length === 0}
          aria-label={playing ? "Pausa" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLoop(layerId, !loop)}
          aria-label="Loop"
          title={loop ? "Loop attivo: la sequenza si ripete" : "Loop spento: si ferma sull’ultimo clip"}
          className={cn(loop ? "text-primary" : "text-muted-foreground")}
        >
          <Repeat className="size-4" />
        </Button>
        <Button
          size="sm"
          variant={smooth ? "secondary" : "outline"}
          onClick={() => setTransitionMode(smooth ? "cut" : "smooth")}
          title={smooth ? "Transizione smooth (crossfade): clicca per passare a secca" : "Transizione secca: clicca per passare a smooth"}
          className={cn("gap-1.5", !smooth && "text-muted-foreground")}
        >
          {smooth ? <Blend data-icon="inline-start" /> : <Zap data-icon="inline-start" />}
          {smooth ? "Smooth" : "Secca"}
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
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setTransitionDuration(v);
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
      <div ref={scrollRef} className="timeline-scroll flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1">
        {clips.length === 0 ? (
          <p className="ui-sublabel self-center leading-relaxed text-muted-foreground/80">
            La sequenza di effetti di <strong className="font-medium text-foreground">{layerName}</strong> è vuota: aggiungi clip col pulsante +. Trascina il
            bordo destro di un clip per cambiarne la durata, passaci sopra e usa i tre puntini per modificarlo. Ogni layer ha la sua sequenza.
          </p>
        ) : (
          clips.map((clip, i) => (
            <ClipBlock
              key={clip.id}
              clip={clip}
              layerId={layerId}
              index={i}
              isDragOver={dragOver === i}
              onDragStart={() => (dragIndex.current = i)}
              onDragOverIndex={() => setDragOver(i)}
              onDrop={() => handleDrop(i)}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOver(null);
              }}
            />
          ))
        )}
      </div>

      <AddClipButton onAdded={scrollToEnd} layerId={layerId} />
        </>
      )}
      </div>
    </div>
  );
}
