import { useEffect } from 'react'
import {
  Lock,
  Unlock,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  FlipVertical,
  Square,
  Grid3x3,
  Magnet,
  Crosshair,
  ChevronsLeftRight,
  ChevronsUpDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useLayersStore } from '@/store/layersStore'
import { useUiStore, NUDGE_STEPS, type CornerSelection } from '@/store/uiStore'

/** Rotazione applicata dai pulsanti ±90°. */
const QUARTER_TURN = Math.PI / 2
/** Rotazione fine: 1° per click, il passo con cui si corregge un proiettore leggermente storto. */
const FINE_ROTATION = Math.PI / 180
/** Fattore di scala per click sui pulsanti larghezza/altezza. */
const SCALE_STEP = 1.02

const CORNER_OPTIONS: { value: CornerSelection; label: string; title: string }[] = [
  { value: null, label: 'Tutti', title: 'Le frecce spostano tutta la proiezione' },
  { value: 0, label: 'TL', title: 'Angolo in alto a sinistra' },
  { value: 1, label: 'TR', title: 'Angolo in alto a destra' },
  { value: 2, label: 'BL', title: 'Angolo in basso a sinistra' },
  { value: 3, label: 'BR', title: 'Angolo in basso a destra' },
]

/**
 * Spostamento fine da tastiera: le frecce muovono l'angolo selezionato (o tutta la proiezione)
 * del passo corrente, Shift lo moltiplica per 5. È il gesto centrale dell'allineamento su un
 * oggetto reale, dove il mouse non ha la risoluzione necessaria.
 */
function useNudgeKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
        return
      }
      // non rubare le frecce a chi sta scrivendo in un campo o regolando uno slider
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      if (target?.closest('[role="slider"]')) return

      const { selectedCorner, nudgeStep } = useUiStore.getState()
      const base = NUDGE_STEPS.find((s) => s.id === nudgeStep)?.value ?? 0.01
      const step = e.shiftKey ? base * 5 : base
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
      const dy = key === 'ArrowDown' ? -step : key === 'ArrowUp' ? step : 0

      e.preventDefault()
      useLayersStore.getState().nudgeActiveCorners(dx, dy, selectedCorner)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}

/**
 * Toolbar flottante di mapping (in basso a sinistra del canvas). Raccoglie i gesti che servono
 * ad allineare la proiezione su un oggetto fisico: scelta dell'angolo da rifinire col passo
 * delle frecce, rotazione/specchiatura/scala del quad, blocco del risultato, griglia di
 * riferimento e test pattern di calibrazione.
 */
export function MappingControls() {
  useNudgeKeys()

  const locked = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.locked ?? false)
  const toggleLocked = useLayersStore((s) => s.toggleActiveLocked)
  const rotate = useLayersStore((s) => s.rotateActiveCorners)
  const scale = useLayersStore((s) => s.scaleActiveCorners)
  const flip = useLayersStore((s) => s.flipActiveCorners)
  const straighten = useLayersStore((s) => s.straightenActiveCorners)
  const testPattern = useLayersStore((s) => s.testPattern)
  const setTestPattern = useLayersStore((s) => s.setTestPattern)

  const selectedCorner = useUiStore((s) => s.selectedCorner)
  const setSelectedCorner = useUiStore((s) => s.setSelectedCorner)
  const nudgeStep = useUiStore((s) => s.nudgeStep)
  const setNudgeStep = useUiStore((s) => s.setNudgeStep)
  const gridVisible = useUiStore((s) => s.gridVisible)
  const toggleGrid = useUiStore((s) => s.toggleGrid)
  const snapEnabled = useUiStore((s) => s.snapEnabled)
  const toggleSnap = useUiStore((s) => s.toggleSnap)

  return (
    <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col gap-1.5 rounded-lg border border-white/10 bg-black/70 p-1.5 backdrop-blur-sm">
      {/* riga 1: bersaglio delle frecce e passo dello spostamento */}
      <div className="flex items-center gap-1">
        <Crosshair className="mx-0.5 size-3.5 shrink-0 text-white/40" />
        {CORNER_OPTIONS.map((opt) => (
          <button
            key={String(opt.value)}
            type="button"
            title={opt.title}
            onClick={() => setSelectedCorner(opt.value)}
            className={cn(
              'min-w-8 rounded px-1.5 py-1 text-[11px] font-medium tabular-nums transition-colors',
              selectedCorner === opt.value
                ? 'bg-purple-500 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {opt.label}
          </button>
        ))}

        <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

        {NUDGE_STEPS.map((step) => (
          <button
            key={step.id}
            type="button"
            title={`Passo delle frecce: ${step.label} (${step.value}). Shift = ×5`}
            onClick={() => setNudgeStep(step.id)}
            className={cn(
              'rounded px-1.5 py-1 text-[11px] font-medium transition-colors',
              nudgeStep === step.id
                ? 'bg-white/20 text-white'
                : 'text-white/60 hover:bg-white/10 hover:text-white',
            )}
          >
            {step.label}
          </button>
        ))}
      </div>

      {/* riga 2: trasformazioni del quad, blocco e riferimenti visivi */}
      <div className="flex items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Ruota di -90°"
          disabled={locked}
          onClick={() => rotate(QUARTER_TURN)}
        >
          <RotateCcw className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Ruota di +90°"
          disabled={locked}
          onClick={() => rotate(-QUARTER_TURN)}
        >
          <RotateCw className="size-3.5" />
        </Button>
        <button
          type="button"
          title="Rotazione fine: -1°"
          disabled={locked}
          onClick={() => rotate(FINE_ROTATION)}
          className="rounded px-1 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          −1°
        </button>
        <button
          type="button"
          title="Rotazione fine: +1°"
          disabled={locked}
          onClick={() => rotate(-FINE_ROTATION)}
          className="rounded px-1 py-1 text-[11px] text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
        >
          +1°
        </button>

        <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

        {/* scala non uniforme: adatta le proporzioni del quad a quelle reali dell'oggetto */}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Allarga (larghezza). Alt+click per restringere"
          disabled={locked}
          onClick={(e) => scale(e.altKey ? 1 / SCALE_STEP : SCALE_STEP, 1)}
        >
          <ChevronsLeftRight className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Allunga (altezza). Alt+click per accorciare"
          disabled={locked}
          onClick={(e) => scale(1, e.altKey ? 1 / SCALE_STEP : SCALE_STEP)}
        >
          <ChevronsUpDown className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Specchia in orizzontale"
          disabled={locked}
          onClick={() => flip('horizontal')}
        >
          <FlipHorizontal className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Specchia in verticale"
          disabled={locked}
          onClick={() => flip('vertical')}
        >
          <FlipVertical className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Raddrizza: riporta i 4 angoli a rettangolo, mantenendo centro e dimensioni"
          disabled={locked}
          onClick={straighten}
        >
          <Square className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Mostra la griglia di allineamento"
          aria-pressed={gridVisible}
          onClick={toggleGrid}
          className={cn(gridVisible && 'text-purple-400 hover:text-purple-300')}
        >
          <Grid3x3 className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Aggancia gli angoli alla griglia mentre li trascini"
          aria-pressed={snapEnabled}
          onClick={toggleSnap}
          className={cn(snapEnabled && 'text-purple-400 hover:text-purple-300')}
        >
          <Magnet className="size-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title="Test pattern di calibrazione: griglia proiettata sull'oggetto, visibile anche in Output"
          aria-pressed={testPattern}
          onClick={() => setTestPattern(!testPattern)}
          className={cn(testPattern && 'text-cyan-400 hover:text-cyan-300')}
        >
          <Crosshair className="size-3.5" />
        </Button>

        <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          title={
            locked
              ? 'Mapping bloccato: sbloccalo per modificarlo'
              : 'Blocca il mapping (evita spostamenti accidentali durante il live)'
          }
          aria-pressed={locked}
          onClick={toggleLocked}
          className={cn(locked && 'text-amber-400 hover:text-amber-300')}
        >
          {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
        </Button>
      </div>
    </div>
  )
}
