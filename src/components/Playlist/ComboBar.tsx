import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Camera, Copy, Download, Eraser, MoreHorizontal, Pause, Play, RefreshCw, Repeat, Send, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { cn } from "@/lib/utils";
import { BLEND_MODES, useLayersStore, type BlendMode } from "@/store/layersStore";
import { useComboStore, type Combo, type ComboCell } from "@/store/comboStore";
import { MIN_CLIP_DURATION, PX_PER_SEC } from "@/store/playlistStore";
import { launchCombo } from "@/hooks/use-combo";
import { effectThumbnail } from "@/engine/effectThumbnail";
import { detectFileKind, ProjectFileError } from "@/lib/projectFile";
import { exportCombosToFile, importFromJson } from "@/lib/persistence";
import { downloadBlob } from "@/lib/download";

const cellKey = (comboId: string, layerId: string) => `${comboId} ${layerId}`;

/** Larghezza minima di una colonna: sotto questa soglia nome e miniature non si leggono più. */
const MIN_COMBO_PX = 96;

/** Bottone-icona delle azioni in hover, identico a quello dei clip. */
const hoverAction =
  "press flex size-5 items-center justify-center rounded text-muted-foreground transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-accent hover:text-foreground";

function CellEditor({ combo, layerId, cell }: { combo: Combo; layerId: string; cell: ComboCell }) {
  const captureCell = useComboStore((s) => s.captureCell);
  const updateCell = useComboStore((s) => s.updateCell);
  const clearCell = useComboStore((s) => s.clearCell);
  const setEditingCell = useComboStore((s) => s.setEditingCell);
  const applyEffectSnapshot = useLayersStore((s) => s.applyEffectSnapshot);
  const setLayerOpacity = useLayersStore((s) => s.setLayerOpacity);
  const setLayerBlendMode = useLayersStore((s) => s.setLayerBlendMode);

  // anteprima sul solo layer della cella: effetto + mixing, senza spegnere gli altri
  const preview = () => {
    applyEffectSnapshot(cell, false, layerId);
    setLayerOpacity(layerId, cell.opacity);
    setLayerBlendMode(layerId, cell.blendMode);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="ui-label truncate font-medium">{cell.shaderName}</span>
        <span className="ui-value shrink-0 text-[10px] text-muted-foreground">size {cell.size.toFixed(2)}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Opacità</span>
          <span className="ui-value text-xs text-muted-foreground">{Math.round(cell.opacity * 100)}%</span>
        </div>
        <Slider min={0} max={1} step={0.01} value={[cell.opacity]} onValueChange={([v]) => updateCell(combo.id, layerId, { opacity: v })} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">Blend</span>
        <Select value={cell.blendMode} onValueChange={(v) => updateCell(combo.id, layerId, { blendMode: v as BlendMode })}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BLEND_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* il look non si modifica qui: si costruisce sul layer col pannello vero e si ricattura */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={preview} title="Mostra questa cella sul suo layer (anteprima)">
          <Send className="size-3.5 shrink-0" />
          Applica
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 gap-1.5"
          onClick={() => captureCell(combo.id, layerId)}
          title="Sostituisci con il look attuale del layer"
        >
          <RefreshCw className="size-3.5 shrink-0" />
          Ricattura
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-destructive"
          onClick={() => {
            clearCell(combo.id, layerId);
            setEditingCell(null);
          }}
          title="Svuota la cella: il layer sarà spento in questa scena"
        >
          <Eraser className="size-3.5 shrink-0" />
        </Button>
      </div>
    </div>
  );
}

function ComboCellView({ combo, layerId, layerName }: { combo: Combo; layerId: string; layerName: string }) {
  const cell = combo.cells[layerId];
  const key = cellKey(combo.id, layerId);
  const isEditing = useComboStore((s) => s.editingCellKey === key);
  const setEditingCell = useComboStore((s) => s.setEditingCell);
  const captureCell = useComboStore((s) => s.captureCell);

  const thumbKey = cell ? JSON.stringify([cell.shaderName, cell.params, cell.colors, cell.size, cell.palette]) : "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const thumb = useMemo(() => (cell ? effectThumbnail(cell) : null), [thumbKey]);

  return (
    <Popover open={isEditing} onOpenChange={(open) => setEditingCell(open ? key : null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={cell ? `${layerName}: ${cell.shaderName}` : `${layerName}: spento in questa scena`}
          style={thumb ? { backgroundImage: `url(${thumb})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
          className={cn(
            "press relative min-h-0 flex-1 overflow-hidden rounded-md border text-left",
            "transition-colors duration-[--dur-fast] ease-[--ease-out]",
            // cella vuota = layer spento: il tratteggio lo dice a colpo d'occhio, prima del lancio
            cell ? "border-transparent bg-sidebar-accent/40" : "border-dashed border-foreground/15 hover:border-foreground/30",
            isEditing && "ring-2 ring-primary/50"
          )}
        >
          {cell && (
            // scrim in basso: il nome resta leggibile su qualsiasi miniatura (§12 vibrancy)
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1 pb-0.5 pt-2 text-[10px] font-medium leading-tight text-white/90">
              {cell.shaderName}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-64">
        {cell ? (
          <CellEditor combo={combo} layerId={layerId} cell={cell} />
        ) : (
          <div className="flex flex-col gap-2">
            <p className="ui-sublabel leading-relaxed text-muted-foreground/80">
              <strong className="font-medium text-foreground">{layerName}</strong> è spento in questa scena.
            </p>
            <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => captureCell(combo.id, layerId)}>
              <Camera className="size-3.5 shrink-0" />
              Cattura dal layer
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function ComboColumn({
  combo,
  layers,
  isDragOver,
  onDragStart,
  onDragOverIndex,
  onDrop,
  onDragEnd
}: {
  combo: Combo;
  layers: { id: string; name: string }[];
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOverIndex: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const isCurrent = useComboStore((s) => s.currentComboId === combo.id);
  const playing = useComboStore((s) => s.playing);
  const progress = useComboStore((s) => (s.currentComboId === combo.id ? s.progress : 0));
  const renameCombo = useComboStore((s) => s.renameCombo);
  const setComboDuration = useComboStore((s) => s.setComboDuration);
  const duplicateCombo = useComboStore((s) => s.duplicateCombo);
  const removeCombo = useComboStore((s) => s.removeCombo);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [resizing, setResizing] = useState(false);

  // stessa gestualità dei clip: la colonna è larga quanto dura e il bordo destro la allunga
  // seguendo il puntatore 1:1, senza attese e senza aprire il popover delle opzioni
  const handleResizeStart = (e: ReactPointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startDuration = combo.duration;
    setResizing(true);
    const onMove = (ev: PointerEvent) => setComboDuration(combo.id, startDuration + (ev.clientX - startX) / PX_PER_SEC);
    const onUp = () => {
      setResizing(false);
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
      style={{ width: Math.max(combo.duration * PX_PER_SEC, MIN_COMBO_PX) }}
      className={cn("group relative flex mt-1 shrink-0 select-none flex-col gap-1", isDragOver && "border-l-4 border-l-primary pl-1 ")}
    >
      {/* intestazione = pulsante di lancio: click → la scena va in onda subito */}
      <div className="relative h-7 shrink-0">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => launchCombo(combo.id)}
          title={`Lancia "${combo.name}" (${combo.duration.toFixed(1)}s)`}
          className={cn("relative w-full justify-start overflow-hidden px-2", isCurrent && "ring-1 ring-primary/70")}
        >
          {isCurrent && (playing || progress > 0) && (
            <span className="pointer-events-none absolute inset-y-0 left-0 bg-primary/10" style={{ width: `${progress * 100}%` }}>
              {progress > 0 && progress < 1 && <span className="absolute inset-y-0 right-0 w-px bg-primary/70" />}
            </span>
          )}
          {isCurrent && playing && <span className="relative size-1.5 shrink-0 animate-pulse rounded-full bg-green-400" />}
          <span className="ui-label relative min-w-0 flex-1 truncate text-left font-medium">{combo.name}</span>
          {/* la durata sta nell'intestazione perché è il numero che il trascinamento sta cambiando:
              senza, il gesto sarebbe muto fino al rilascio */}
          <span className="ui-value relative shrink-0 text-[10px] text-muted-foreground">{combo.duration.toFixed(1)}s</span>
        </Button>
        <div
          draggable={false}
          onDragStart={(e) => e.stopPropagation()}
          className={cn(
            "absolute right-1 top-1 z-10 flex items-center rounded-md bg-card/90 p-0.5 opacity-0 shadow-sm backdrop-blur-sm",
            "transition-opacity duration-[--dur-fast] ease-[--ease-out]",
            !resizing && "group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100",
            menuOpen && "opacity-100"
          )}
        >
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Opzioni combo" title="Opzioni combo" className={hoverAction}>
                <MoreHorizontal className="size-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="flex w-60 flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Nome</span>
                <Input value={combo.name} onChange={(e) => renameCombo(combo.id, e.target.value)} className="h-8" />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Durata (s)</span>
                <Input
                  type="number"
                  min={MIN_CLIP_DURATION}
                  step={0.5}
                  value={Number(combo.duration.toFixed(1))}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v)) setComboDuration(combo.id, v);
                  }}
                  className="h-8 w-20"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1 gap-1.5" onClick={() => duplicateCombo(combo.id)}>
                  <Copy className="size-3.5 shrink-0" />
                  Duplica
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-3.5 shrink-0" />
                  Elimina
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {layers.map((l) => (
        <ComboCellView key={l.id} combo={combo} layerId={l.id} layerName={l.name} />
      ))}

      {/* maniglia di resize della durata (bordo destro): area di presa larga, segno visivo
          sottile finché non ci si passa sopra — identica a quella dei clip */}
      <div
        draggable={false}
        onDragStart={(e) => e.stopPropagation()}
        onPointerDown={handleResizeStart}
        onClick={(e) => e.stopPropagation()}
        title="Trascina per cambiare la durata"
        className={cn(
          "group/handle absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-end",
          "transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-primary/10",
          resizing && "bg-primary/10"
        )}
      >
        <span
          className={cn(
            "h-5 w-px transition-colors duration-[--dur-fast] ease-[--ease-out]",
            resizing ? "bg-primary/70" : "bg-foreground/10 group-hover:bg-foreground/20 group-hover/handle:bg-primary/70"
          )}
        />
      </div>

      <ConfirmDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        itemName={combo.name}
        description="La colonna viene tolta dalla griglia. I layer restano come sono adesso."
        onConfirm={() => removeCombo(combo.id)}
      />
    </div>
  );
}

/**
 * Tab "Combo" della barra playlist: la griglia delle scene multi-layer. Righe = i layer nello
 * stesso ordine dello stack (dall'alto), colonne = combo. Una colonna congela il look di ogni
 * layer; lanciata, li cambia tutti insieme. Il motore della sequenza è `useCombo`, nella pagina.
 */
export function ComboBar({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const layers = useLayersStore((s) => s.layers);
  const combos = useComboStore((s) => s.combos);
  const playing = useComboStore((s) => s.playing);
  const loop = useComboStore((s) => s.loop);
  const setPlaying = useComboStore((s) => s.setPlaying);
  const setLoop = useComboStore((s) => s.setLoop);
  const captureCombo = useComboStore((s) => s.captureCombo);
  const reorderCombos = useComboStore((s) => s.reorderCombos);

  // stesso ordine della lista layer: la cima dello stack è in cima alla griglia
  const display = useMemo(() => [...layers].reverse().map((l) => ({ id: l.id, name: l.name })), [layers]);

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const handleDrop = (to: number) => {
    if (dragIndex.current != null) reorderCombos(dragIndex.current, to);
    dragIndex.current = null;
    setDragOver(null);
  };

  const scrollToEnd = () =>
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTo({ left: el.scrollWidth, behavior: "smooth" });
    });
  const capture = () => {
    captureCombo();
    scrollToEnd();
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const handleImportFile = async (file: File) => {
    setStatus(null);
    try {
      const text = await file.text();
      // il tipo si controlla PRIMA: un progetto o una libreria non devono entrare da qui
      if (detectFileKind(text) !== "combos") {
        setStatus({ kind: "error", text: "Non è un file di combo: progetti e preset si importano dai loro pannelli." });
        return;
      }
      const result = await importFromJson(text);
      if (result.kind !== "combos") return;
      setStatus({
        kind: "ok",
        text: `${result.imported} combo aggiunte${result.dropped > 0 ? `, ${result.dropped} celle scartate: il progetto ha meno layer` : ""}.`
      });
      scrollToEnd();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof ProjectFileError ? err.message : "Importazione non riuscita." });
    }
  };
  const handleExport = () => {
    const out = exportCombosToFile();
    if (out) downloadBlob("combo.easymap.json", out.blob);
  };

  return (
    <>
      {/* colonna compatta: cattura in evidenza sopra, trasporto e file sotto — più stretta della
          riga orizzontale di prima, lascia più posto alla griglia scrollabile */}
      <div className="my-auto flex shrink-0 flex-col gap-1.5">
        <Button variant="secondary" className="w-full gap-1.5" onClick={capture} title="Fotografa tutti i layer visibili in una nuova colonna">
          <Camera data-icon="inline-start" />
          Cattura scena
        </Button>
        <div className="flex gap-1.5">
          <Button
            size="icon"
            variant={playing ? "default" : "secondary"}
            className="flex-1"
            onClick={() => setPlaying(!playing)}
            disabled={combos.length === 0}
            aria-label={playing ? "Pausa" : "Play"}
            title="Sequenza automatica: le colonne scorrono con la loro durata"
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn("flex-1", loop ? "text-primary" : "text-muted-foreground")}
            onClick={() => setLoop(!loop)}
            aria-label="Loop"
            title={loop ? "Loop attivo: la sequenza si ripete" : "Loop spento: si ferma sull’ultima colonna"}
          >
            <Repeat className="size-4" />
          </Button>
        </div>
        <div className="flex gap-1.5">
          <Button
            size="icon"
            variant="ghost"
            className="flex-1"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Importa combo"
            title="Importa combo da file"
          >
            <Upload className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="flex-1"
            onClick={handleExport}
            disabled={combos.length === 0}
            aria-label="Esporta combo"
            title="Esporta le combo su file"
          >
            <Download className="size-4" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            // si azzera sempre: riselezionare lo STESSO file non emetterebbe un altro change
            e.target.value = "";
            if (file) void handleImportFile(file);
          }}
        />
      </div>

      <Separator orientation="vertical" className="h-auto" />

      <div ref={scrollRef} className="timeline-scroll flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1">
        {status ? (
          <p
            className={cn("ui-sublabel self-center leading-relaxed", status.kind === "error" ? "text-destructive" : "text-muted-foreground/80")}
            role="status"
            onClick={() => setStatus(null)}
          >
            {status.text}
          </p>
        ) : combos.length === 0 ? (
          <p className="ui-sublabel self-center leading-relaxed text-muted-foreground/80">
            Nessuna combo: imposta i layer come li vuoi e premi <strong className="font-medium text-foreground">Cattura scena</strong>. Ogni colonna congela il
            look di tutti i layer; cliccandola vanno in onda insieme. Le celle vuote spengono il layer.
          </p>
        ) : (
          <>
            {/* nomi dei layer, fissi a sinistra mentre le colonne scorrono */}
            <div className="sticky left-0 z-10 flex w-24 shrink-0 flex-col gap-1 bg-sidebar pr-1.5">
              <div className="h-7 shrink-0" />
              {display.map((l) => (
                <div key={l.id} className="flex min-h-0 flex-1 items-center">
                  <span className="ui-label truncate text-muted-foreground">{l.name}</span>
                </div>
              ))}
            </div>
            {combos.map((combo, i) => (
              <ComboColumn
                key={combo.id}
                combo={combo}
                layers={display}
                isDragOver={dragOver === i}
                onDragStart={() => (dragIndex.current = i)}
                onDragOverIndex={() => setDragOver(i)}
                onDrop={() => handleDrop(i)}
                onDragEnd={() => {
                  dragIndex.current = null;
                  setDragOver(null);
                }}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
