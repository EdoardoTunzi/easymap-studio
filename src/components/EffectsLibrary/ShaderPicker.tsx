import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useEffectsStore } from '@/store/effectsStore'

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
  const listRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return shaders
    return shaders.filter((s) => s.name.toLowerCase().includes(q))
  }, [shaders, query])

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
          <span className="px-2 py-1 text-xs text-muted-foreground">Nessun effetto trovato</span>
        )}
      </div>
    </div>
  )
}
