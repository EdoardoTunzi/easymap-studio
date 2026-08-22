import { useCallback, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Plus, Copy, Trash2, GripVertical, Lock, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLayersStore } from "@/store/layersStore";
import { useUiStore } from "@/store/uiStore";

/** §9: oltre il bordo la riga continua a seguire il dito, ma sempre meno. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

const DRAG_THRESHOLD = 6; // §10: un po' di isteresi, così un click sulla maniglia resta un click

interface DragState {
  /** indice di partenza nella lista mostrata (0 = layer in primo piano) */
  from: number;
  /** indice dello slot su cui la riga si poserebbe adesso */
  to: number;
  /** spostamento verticale applicato alla riga trascinata, in px */
  dy: number;
  /** passo fra due righe (altezza + gap), misurato dal DOM al momento della presa */
  step: number;
  active: boolean;
}

/**
 * Lista dei layer: è la selezione che comanda tutto il resto della colonna destra, quindi resta
 * ancorata in alto e non scorre con i blocchi sottostanti (scorre al proprio interno se i layer
 * sono molti).
 *
 * Il riordino usa Pointer Events invece dell'HTML5 drag & drop: la riga resta incollata al
 * puntatore 1:1 (§2 della skill apple-design) rispettando il punto in cui è stata afferrata, le
 * righe vicine scivolano per fare spazio, e ai bordi della lista la resistenza cresce invece di
 * bloccarsi di colpo (§9). L'HTML5 drag & drop non permette niente di tutto questo: dà solo un
 * fantasma disegnato dal browser e nessun controllo sul movimento intermedio.
 */
export function LayerList() {
  const layers = useLayersStore((s) => s.layers);
  const activeLayerId = useLayersStore((s) => s.activeLayerId);
  const selectLayer = useLayersStore((s) => s.selectLayer);
  const addLayer = useLayersStore((s) => s.addLayer);
  const removeLayer = useLayersStore((s) => s.removeLayer);
  const duplicateLayer = useLayersStore((s) => s.duplicateLayer);
  const reorderLayers = useLayersStore((s) => s.reorderLayers);
  const setLayerVisible = useLayersStore((s) => s.setLayerVisible);
  const paletteLoopLayerIds = useUiStore((s) => s.paletteLoopLayerIds);

  const listRef = useRef<HTMLUListElement>(null);
  /**
   * Il drag vive in una ref e viene solo *rispecchiato* nello stato per il render. Tenerlo nello
   * stato e aggiornarlo con un updater che avvia timer o scrive ref non funziona: in StrictMode
   * React invoca gli updater due volte per verificarne la purezza, e il riordino veniva applicato
   * due volte annullandosi da solo.
   */
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  /**
   * Un frame senza transizioni, subito dopo che l'ordine è cambiato davvero. Al commit React
   * riusa i nodi per `key`: la riga che era scostata di uno slot si ritrova nella posizione dove
   * era già disegnata, e con la transizione accesa animerebbe una seconda volta un movimento che
   * l'occhio ha già visto. Spegnendola per un frame il passaggio è invisibile.
   */
  const [settling, setSettling] = useState(false);
  /** riordino già deciso ma non ancora scritto nello store: la riga si sta posando */
  const settleRef = useRef<{ from: number; to: number; timer: number } | null>(null);

  // La lista si mostra dall'alto (in primo piano) verso il basso (sfondo): l'ultimo layer
  // dell'array è il topmost. displayIndex 0 = topmost.
  const display = [...layers].reverse();

  const commit = useCallback(
    (from: number, to: number) => {
      if (from === to) return;
      // la conversione display → array è ripetuta qui invece di usare toArrayIndex: quella closure
      // si ricrea a ogni render e renderebbe instabile commit (e con lui il cleanup di flushSettle)
      const last = layers.length - 1;
      setSettling(true);
      reorderLayers(last - from, last - to);
      requestAnimationFrame(() => requestAnimationFrame(() => setSettling(false)));
    },
    [reorderLayers, layers.length],
  );

  /** Chiude subito un assestamento in corso: serve se l'utente riafferra prima della fine (§3). */
  const flushSettle = useCallback(() => {
    const pending = settleRef.current;
    if (!pending) return;
    window.clearTimeout(pending.timer);
    settleRef.current = null;
    dragRef.current = null;
    setDrag(null);
    commit(pending.from, pending.to);
  }, [commit]);

  useEffect(() => () => flushSettle(), [flushSettle]);

  const handlePointerDown = (e: React.PointerEvent, displayIndex: number, layerId: string) => {
    if (e.button !== 0) return;
    // §1: la selezione risponde alla pressione, non al rilascio — anche se poi si trascina
    selectLayer(layerId);
    e.stopPropagation();
    if (layers.length < 2) return;
    flushSettle();
    e.preventDefault();

    const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    if (rows.length < 2) return;
    // passo reale fra due righe: include il gap, quindi non va indovinato
    const step = rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top;
    if (step <= 0) return;

    const startY = e.clientY;
    const target = e.currentTarget as HTMLElement;
    // niente selezione di testo mentre la riga viene trascinata
    document.body.style.userSelect = "none";
    // §2: la cattura tiene agganciato il puntatore anche fuori dai bordi della riga. Può fallire
    // se il pointer è già stato rilasciato altrove: in quel caso i listener su window bastano.
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      /* nessuna cattura: si prosegue con i listener globali */
    }

    let started = false;
    const minDy = -displayIndex * step;
    const maxDy = (rows.length - 1 - displayIndex) * step;
    const span = rows.length * step;

    const onMove = (ev: PointerEvent) => {
      const raw = ev.clientY - startY;
      if (!started) {
        if (Math.abs(raw) < DRAG_THRESHOLD) return;
        started = true;
      }
      // dentro i limiti si segue il dito 1:1; fuori, la resistenza cresce
      const dy =
        raw < minDy
          ? minDy + rubberband(raw - minDy, span)
          : raw > maxDy
            ? maxDy + rubberband(raw - maxDy, span)
            : raw;
      const to = Math.max(0, Math.min(rows.length - 1, displayIndex + Math.round(raw / step)));
      const next: DragState = { from: displayIndex, to, dy, step, active: true };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      try {
        target.releasePointerCapture(e.pointerId);
      } catch {
        /* già rilasciata */
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const d = dragRef.current;
      if (!started || !d) {
        dragRef.current = null;
        setDrag(null);
        return;
      }

      // la riga si posa sullo slot scelto: prima arriva, poi l'ordine cambia davvero, così non si
      // vede nessun salto fra la fine dell'animazione e il nuovo layout
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const settled: DragState = { ...d, dy: (d.to - d.from) * d.step, active: false };
      dragRef.current = settled;
      setDrag(settled);

      settleRef.current = {
        from: d.from,
        to: d.to,
        timer: window.setTimeout(
          () => {
            settleRef.current = null;
            dragRef.current = null;
            commit(d.from, d.to);
            setDrag(null);
          },
          reduced ? 0 : 320,
        ),
      };
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  /** Di quanto deve scostarsi una riga non trascinata per fare spazio a quella in volo. */
  const shiftFor = (index: number) => {
    if (!drag) return 0;
    const { from, to, step } = drag;
    if (index === from) return 0;
    if (from < to && index > from && index <= to) return -step;
    if (from > to && index < from && index >= to) return step;
    return 0;
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="ui-eyebrow text-muted-foreground">Layers</span>
        <Button variant="secondary" size="sm" className="press h-7 gap-1.5" onClick={() => addLayer()}>
          <Plus className="size-3.5" />
          Nuovo
        </Button>
      </div>

      <ul ref={listRef} className="flex max-h-fit flex-col gap-1 overflow-y-auto">
        {display.map((layer, di) => {
          const active = layer.id === activeLayerId;
          const dragged = drag?.from === di;
          const offset = dragged ? drag.dy : shiftFor(di);
          return (
            <li
              key={layer.id}
              onPointerDown={() => selectLayer(layer.id)}
              style={{
                transform: offset ? `translate3d(0, ${offset}px, 0)` : undefined,
                // la riga in volo segue il dito senza transizione (sarebbe un ritardo, §1);
                // le altre e l'assestamento finale scivolano con la curva di sistema
                transition:
                  settling || (dragged && drag.active)
                    ? "none"
                    : "transform var(--dur-base) var(--ease-fluid), border-color var(--dur-fast) var(--ease-out), background-color var(--dur-fast) var(--ease-out)",
                zIndex: dragged ? 2 : undefined,
                position: dragged ? "relative" : undefined,
              }}
              className={cn(
                "group/row flex cursor-pointer items-center gap-1.5 rounded-lg border px-1.5 py-1.5 select-none",
                active
                  ? "border-primary/70 bg-sidebar-accent/70"
                  : "border-transparent bg-sidebar-accent/25 hover:bg-sidebar-accent/45",
                dragged && drag.active && "border-primary/70 bg-sidebar-accent shadow-lg shadow-black/40",
              )}
            >
              {/* §10: l'icona resta piccola, ma l'area che risponde è allargata di ~8px per lato
                  con uno pseudo-elemento — a soli 14px la maniglia era difficile da centrare */}
              <span
                onPointerDown={(e) => handlePointerDown(e, di, layer.id)}
                role="button"
                tabIndex={-1}
                aria-label="Trascina per riordinare"
                className={cn(
                  "relative shrink-0 touch-none transition-colors duration-[--dur-fast]",
                  "after:absolute after:-inset-2 after:content-['']",
                  dragged && drag.active
                    ? "cursor-grabbing text-foreground"
                    : "cursor-grab text-muted-foreground/50 hover:text-foreground group-hover/row:text-muted-foreground",
                )}
              >
                <GripVertical className="size-3.5" />
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayerVisible(layer.id, !layer.visible);
                }}
                className="press shrink-0 cursor-pointer text-muted-foreground transition-colors duration-[--dur-fast] hover:text-foreground"
                aria-label={layer.visible ? "Nascondi layer" : "Mostra layer"}
              >
                {layer.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </button>
              <span
                className={cn(
                  "ui-label flex-1 truncate text-[0.8125rem]",
                  layer.visible ? "text-foreground" : "text-muted-foreground line-through",
                )}
              >
                {layer.name}
              </span>
              {/* il lucchetto del mapping è uno stato che va visto senza dover selezionare il layer */}
              {layer.locked && <Lock className="size-3 shrink-0 text-amber-400" aria-label="Mapping bloccato" />}
              {/* il loop delle palette gira per-layer: da qui si vede su quali senza selezionarli */}
              {paletteLoopLayerIds.includes(layer.id) && (
                <Repeat className="size-3 shrink-0 animate-pulse text-primary" aria-label="Loop palette attivo" />
              )}
              <span className="shrink-0 text-[10px] tracking-[0.04em] uppercase text-muted-foreground/70">
                {layer.shaderName ? layer.blendMode : ""}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  duplicateLayer(layer.id);
                }}
                className="row-action press shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                aria-label="Duplica layer"
              >
                <Copy className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeLayer(layer.id);
                }}
                disabled={layers.length <= 1}
                className="row-action press shrink-0 cursor-pointer text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-20"
                aria-label="Elimina layer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
