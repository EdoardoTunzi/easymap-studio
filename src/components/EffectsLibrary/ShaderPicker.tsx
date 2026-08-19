import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffectsStore } from '@/store/effectsStore'
import { useUiStore } from '@/store/uiStore'
import { SHADER_CATEGORIES } from '@/lib/shaderCategories'

interface ShaderPickerProps {
  value: string
  onChange: (shaderName: string) => void
  /** Altezza della lista scrollabile (classe Tailwind). */
  className?: string
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
  const shaders = useEffectsStore((s) => s.shaders)
  const [query, setQuery] = useState('')
  // il filtro vive nello store: comanda anche lo scorrimento con le frecce e ⌥A/⌥S
  const category = useUiStore((s) => s.shaderCategory)
  const setCategory = useUiStore((s) => s.setShaderCategory)
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  /** Quanti effetti per famiglia: il numero sul pulsante dice subito dove vale la pena guardare. */
  const counts = useMemo(() => {
    const map = new Map<string, number>([['all', shaders.length]])
    for (const s of shaders) map.set(s.category, (map.get(s.category) ?? 0) + 1)
    return map
  }, [shaders])

  const byQuery = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return shaders
    return shaders.filter((s) => s.name.toLowerCase().includes(q))
  }, [shaders, query])

  const filtered = useMemo(
    () => (category === 'all' ? byQuery : byQuery.filter((s) => s.category === category)),
    [byQuery, category],
  )

  // Una ricerca che non dà nulla NELLA famiglia scelta, ma trova altrove, è il modo più facile
  // di credere che un effetto non esista: si offre la via d'uscita invece di una lista vuota.
  // Solo mentre si cerca: filtrare per famiglia è una scelta esplicita, e ricordare a ogni click
  // quanti effetti restano fuori sarebbe soltanto rumore.
  const searching = query.trim().length > 0
  const hiddenByCategory = searching && category !== 'all' ? byQuery.length - filtered.length : 0

  // riporta in vista l'effetto attivo quando cambia (frecce, hotkey, playlist), mai mentre si scorre
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [value])

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca effetto…"
          className="h-7 pl-7 text-xs"
          aria-label="Cerca effetto"
        />
      </div>
      {/* Filtri per famiglia: con oltre cento effetti scorrere l'elenco intero non è praticabile.
          A capo invece che in riga scorrevole: la sidebar è stretta e ridimensionabile, e dei
          pulsanti che escono dal bordo sarebbero irraggiungibili proprio dove serve. */}
      <div className="flex flex-wrap gap-1">
        {SHADER_CATEGORIES.map((c) => {
          const count = counts.get(c.id) ?? 0
          if (count === 0) return null
          const isActive = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              title={`${c.hint} (${count})`}
              aria-pressed={isActive}
              className={cn(
                'flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors',
                isActive
                  ? 'border-primary/60 bg-secondary font-medium text-secondary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent/50',
              )}
            >
              {c.label}
              <span className="tabular-nums opacity-60">{count}</span>
            </button>
          )
        })}
      </div>

      {/* overscroll-contain: arrivati a fondo lista lo scroll non prosegue trascinando la sidebar */}
      <div
        ref={listRef}
        className={cn(
          'flex flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-md border border-border p-1',
          className ?? 'h-56',
        )}
        role="listbox"
        aria-label="Libreria effetti"
      >
        {filtered.map((s) => {
          const isActive = s.name === value
          return (
            <button
              key={s.name}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => onChange(s.name)}
              className={cn(
                'shrink-0 truncate rounded px-2 py-1 text-left text-sm transition-colors',
                isActive
                  ? 'bg-secondary font-medium text-secondary-foreground'
                  : 'hover:bg-accent/50',
              )}
              title={s.name}
            >
              {s.name}
            </button>
          )
        })}
        {filtered.length === 0 && (
          <span className="px-2 py-1 text-xs text-muted-foreground">
            {hiddenByCategory > 0 ? 'Nessun risultato in questa famiglia' : 'Nessun effetto trovato'}
          </span>
        )}
      </div>
      {hiddenByCategory > 0 && (
        <button
          type="button"
          onClick={() => setCategory('all')}
          className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {hiddenByCategory} {hiddenByCategory === 1 ? 'risultato' : 'risultati'} in altre famiglie —
          mostra tutti
        </button>
      )}
    </div>
  )
}
