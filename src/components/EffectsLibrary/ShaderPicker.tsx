import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { NONE_SHADER_NAME, useEffectsStore } from "@/store/effectsStore";
import { useUiStore } from "@/store/uiStore";
import { SHADER_CATEGORIES, SHADER_GROUPS } from "@/lib/shaderCategories";
import { Button } from "../ui/button";

interface ShaderPickerProps {
  value: string;
  onChange: (shaderName: string) => void;
  /** Altezza della lista scrollabile (classe Tailwind). */
  className?: string;
}

/**
 * Selettore dell'effetto: campo di ricerca + lista scrollabile sempre aperta.
 *
 * Sostituisce la vecchia `Select` a tendina, inutilizzabile con una libreria di ~100 shader:
 * Radix la apre in modalità `item-aligned`, cioè ancorata all'elemento selezionato, e su liste
 * lunghe il menu riportava la vista sull'effetto corrente rendendo impossibile scorrere gli altri.
 * Una lista inline non ha ancoraggi da rispettare: si scorre e basta.
 *
 * L'unico scroll automatico avviene quando l'effetto cambia da FUORI (frecce ◀ ▶, scorciatoie
 * ⌥A/⌥S, playlist): serve a non perdere di vista l'effetto corrente, ma usa `block: 'nearest'`,
 * quindi non muove nulla se è già visibile — è la differenza con il comportamento di prima.
 */
export function ShaderPicker({ value, onChange, className }: ShaderPickerProps) {
  const shaders = useEffectsStore((s) => s.shaders);
  const [query, setQuery] = useState("");
  // i filtri vivono nello store: comandano anche lo scorrimento con le frecce e ⌥A/⌥S
  const category = useUiStore((s) => s.shaderCategory);
  const setCategory = useUiStore((s) => s.setShaderCategory);
  const group = useUiStore((s) => s.shaderGroup);
  const setGroup = useUiStore((s) => s.setShaderGroup);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  /** Gli effetti che restano dopo il solo filtro O/S: è la base su cui si contano le famiglie. */
  const byGroup = useMemo(
    () => (group === null ? shaders : shaders.filter((s) => s.group === group)),
    [shaders, group],
  );

  /**
   * Quanti effetti per famiglia: il numero sul pulsante dice subito dove vale la pena guardare.
   * Contati **dentro** il filtro O/S attivo, così una famiglia che lì non ha nulla scompare da sé
   * (la logica dei pulsanti nasconde già quelli a zero) senza una tabella famiglia→gruppo da tenere
   * allineata alla mappa.
   */
  const counts = useMemo(() => {
    const map = new Map<string, number>([["all", byGroup.length]]);
    for (const s of byGroup) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    return map;
  }, [byGroup]);

  /** Quanti effetti per gruppo, per il numero sui due pulsanti-leggenda (sull'intera libreria). */
  const groupCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of shaders) map.set(s.group, (map.get(s.group) ?? 0) + 1);
    return map;
  }, [shaders]);

  const byQuery = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return byGroup;
    return byGroup.filter((s) => s.name.toLowerCase().includes(q));
  }, [byGroup, query]);

  const filtered = useMemo(() => (category === "all" ? byQuery : byQuery.filter((s) => s.category === category)), [byQuery, category]);

  // Cambiando il filtro O/S la famiglia scelta può restare senza effetti: il suo pulsante sparisce
  // e resterebbe una lista vuota con un filtro attivo ma invisibile, cioè inspiegabile. Si torna
  // su "Tutti", che è il solo stato in cui la selezione non contraddice quello che si vede.
  useEffect(() => {
    if (category !== "all" && (counts.get(category) ?? 0) === 0) setCategory("all");
  }, [category, counts, setCategory]);

  // Una ricerca che non dà nulla NELLA famiglia scelta, ma trova altrove, è il modo più facile
  // di credere che un effetto non esista: si offre la via d'uscita invece di una lista vuota.
  // Solo mentre si cerca: filtrare per famiglia è una scelta esplicita, e ricordare a ogni click
  // quanti effetti restano fuori sarebbe soltanto rumore.
  const searching = query.trim().length > 0;
  const hiddenByCategory = searching && category !== "all" ? byQuery.length - filtered.length : 0;

  // riporta in vista l'effetto attivo quando cambia (frecce, hotkey, playlist), mai mentre si scorre
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [value]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cerca effetto…" className="h-8 pl-7 text-xs" aria-label="Cerca effetto" />
      </div>
      {/* Filtro sul comportamento, che è anche la LEGGENDA delle lettere in elenco: la differenza
          fra un effetto che si modella sull'asset e uno che lo ignora non si legge dal nome, e la
          "O" blu accanto a un nome non direbbe nulla senza questi due pulsanti sopra a spiegarla.
          Sono esclusivi e si spengono ri-cliccandoli: a riposo le famiglie restano tutte insieme. */}
      <div className="flex gap-1">
        {SHADER_GROUPS.map((g) => {
          const isActive = group === g.id;
          return (
            <Button
              key={g.id}
              variant="outline"
              size="xs"
              onClick={() => setGroup(isActive ? null : g.id)}
              title={`${g.hint} (${groupCounts.get(g.id) ?? 0})`}
              aria-pressed={isActive}
              className={cn(
                "press flex-1 gap-1.5 transition-colors duration-[--dur-fast] ease-[--ease-out]",
                isActive
                  ? "border-current bg-secondary font-medium hover:bg-secondary"
                  : "border-border text-muted-foreground hover:bg-accent/50",
                isActive && g.color
              )}
            >
              <span className={cn("font-semibold", g.color)}>{g.letter}</span>
              {g.label}
            </Button>
          );
        })}
      </div>
      {/* Filtri per famiglia: con oltre cento effetti scorrere l'elenco intero non è praticabile.
          A capo invece che in riga scorrevole: la sidebar è stretta e ridimensionabile, e dei
          pulsanti che escono dal bordo sarebbero irraggiungibili proprio dove serve. Le famiglie
          senza effetti nel filtro O/S attivo spariscono da sole: i conteggi sono già calcolati
          dentro quel filtro, e un pulsante a zero non si mostra. */}
      <div className="flex flex-wrap gap-1">
        {SHADER_CATEGORIES.map((c) => {
          const count = counts.get(c.id) ?? 0;
          if (count === 0) return null;
          const isActive = category === c.id;
          return (
            <Button
              key={c.id}
              variant="outline"
              size="xs"
              onClick={() => setCategory(c.id)}
              title={`${c.hint} (${count})`}
              aria-pressed={isActive}
              className={cn(
                // altezza e raggio arrivano dalla size del componente: prima erano riscritti a mano
                // e i chip finivano più alti dei loro contenuti (§16 Craft)
                "press gap-1 transition-colors duration-[--dur-fast] ease-[--ease-out]",
                isActive
                  ? "border-primary/60 bg-secondary font-medium text-secondary-foreground hover:bg-secondary"
                  : "border-border text-muted-foreground hover:bg-accent/50"
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-60">{count}</span>
            </Button>
          );
        })}
      </div>

      {/* overscroll-contain: arrivati a fondo lista lo scroll non prosegue trascinando la sidebar */}
      <div
        ref={listRef}
        className={cn("flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-lg border border-border p-1", className ?? "h-56")}
        role="listbox"
        aria-label="Libreria effetti"
      >
        {filtered.map((s) => {
          const isActive = s.name === value;
          // "Nessun effetto" è il blackout, non un effetto: una lettera di comportamento su di lui
          // sarebbe una risposta a una domanda che non ha senso porgli.
          const groupInfo = s.name === NONE_SHADER_NAME ? undefined : SHADER_GROUPS.find((g) => g.id === s.group);
          return (
            <button
              key={s.name}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => onChange(s.name)}
              className={cn(
                "press flex shrink-0 cursor-pointer items-center justify-between gap-2 rounded-md border px-2 py-1 text-left text-sm",
                "transition-colors duration-[--dur-fast] ease-[--ease-out]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
                isActive
                  ? "border-primary/60 bg-secondary font-medium text-secondary-foreground"
                  : "border-transparent hover:bg-accent/50"
              )}
              title={groupInfo ? `${s.name} — ${groupInfo.label}: ${groupInfo.hint}` : s.name}
            >
              <span className="truncate">{s.name}</span>
              {groupInfo && (
                <span className={cn("shrink-0 text-xs font-semibold", groupInfo.color)} aria-label={groupInfo.label}>
                  {groupInfo.letter}
                </span>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <span className="px-2 py-1 text-xs text-muted-foreground">
            {hiddenByCategory > 0 ? "Nessun risultato in questa famiglia" : "Nessun effetto trovato"}
          </span>
        )}
      </div>
      {hiddenByCategory > 0 && (
        <button
          type="button"
          onClick={() => setCategory("all")}
          className="cursor-pointer self-start text-[11px] text-muted-foreground underline underline-offset-2 transition-colors duration-[--dur-fast] ease-[--ease-out] hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        >
          {hiddenByCategory} {hiddenByCategory === 1 ? "risultato" : "risultati"} in altre famiglie — mostra tutti
        </button>
      )}
    </div>
  );
}
