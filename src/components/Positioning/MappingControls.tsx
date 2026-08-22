import { useEffect, useState } from 'react'
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
  PanelTop,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Spline,
  Eraser,
  Grid2x2,
  Undo2,
  Redo2,
  Minimize2,
  Maximize2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useLayersStore } from '@/store/layersStore'
import {
  useUiStore,
  NUDGE_STEPS,
  sameSelection,
  selectionCornerIndices,
  type MappingSelection,
} from '@/store/uiStore'
import {
  isWarpActive,
  warpMode,
  GRID_MIN_CELLS,
  GRID_MAX_CELLS,
  GRID_DEFAULT_CELLS,
  WARP_EDGE_LABELS,
  type WarpEdgeId,
} from '@/lib/warp'

/** Rotazione applicata dai pulsanti ±90°. */
const QUARTER_TURN = Math.PI / 2
/** Rotazione fine: 1° per click, il passo con cui si corregge un proiettore leggermente storto. */
const FINE_ROTATION = Math.PI / 180
/** Fattore di scala per click sui pulsanti larghezza/altezza. */
const SCALE_STEP = 1.02
/** Passo del keystone per click: la stessa grana fine della rotazione da 1°. */
const KEYSTONE_STEP = 0.015

/** Celle per asse selezionabili per il reticolo (2 celle = 3×3 nodi). */
const GRID_SIZES = Array.from(
  { length: GRID_MAX_CELLS - GRID_MIN_CELLS + 1 },
  (_, i) => GRID_MIN_CELLS + i,
)

/** Stato compresso/espanso della toolbar, ricordato tra le sessioni come l'altezza della playlist. */
const COLLAPSED_KEY = 'easyvj-mapping-toolbar-collapsed'

/** Sfondo dei pulsanti-pillola quando selezionati/attivi: `hover:` ripetuto sullo stesso colore
 * perché altrimenti l'hover di `variant="ghost"` (pensato per le card dell'app, non per una
 * toolbar nera) riprenderebbe il sopravvento e la pillola sbiadirebbe passandoci sopra. Stringhe
 * letterali e non costruite a runtime: Tailwind genera le classi scansionando il testo del file,
 * un `` `hover:${bg}` `` con `bg` variabile non produrrebbe alcuna regola CSS. */
const PILL_IDLE = 'text-white/60 hover:bg-white/10 hover:text-white'
const PILL_ACTIVE_PURPLE = 'bg-purple-500 text-white hover:bg-purple-500 hover:text-white'
const PILL_ACTIVE_CYAN = 'bg-cyan-500 text-white hover:bg-cyan-500 hover:text-white'
const PILL_ACTIVE_WHITE = 'bg-white/20 text-white hover:bg-white/20 hover:text-white'

const SELECTION_OPTIONS: { value: MappingSelection; label: string; title: string }[] = [
  { value: { kind: 'all' }, label: 'Tutti', title: 'Le frecce spostano tutta la proiezione' },
  { value: { kind: 'corner', index: 0 }, label: 'TL', title: 'Angolo in alto a sinistra' },
  { value: { kind: 'corner', index: 1 }, label: 'TR', title: 'Angolo in alto a destra' },
  { value: { kind: 'corner', index: 2 }, label: 'BL', title: 'Angolo in basso a sinistra' },
  { value: { kind: 'corner', index: 3 }, label: 'BR', title: 'Angolo in basso a destra' },
]

/** Selezione di un intero lato: le frecce muovono insieme i due angoli che lo delimitano. */
const EDGE_OPTIONS: { edge: WarpEdgeId; Icon: typeof PanelTop }[] = [
  { edge: 'top', Icon: PanelTop },
  { edge: 'bottom', Icon: PanelBottom },
  { edge: 'left', Icon: PanelLeft },
  { edge: 'right', Icon: PanelRight },
]

/**
 * Spostamento fine da tastiera: le frecce muovono l'angolo selezionato (o tutta la proiezione)
 * del passo corrente, Shift lo moltiplica per 5. È il gesto centrale dell'allineamento su un
 * oggetto reale, dove il mouse non ha la risoluzione necessaria.
 */
function useNudgeKeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // non rubare i tasti a chi sta scrivendo in un campo o regolando uno slider
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) {
        return
      }
      if (typeof target?.closest === 'function' && target.closest('[role="slider"]')) return

      // annulla/ripeti del mapping: ⌘Z su macOS, Ctrl+Z altrove
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        const store = useLayersStore.getState()
        if (e.shiftKey) store.redoMapping()
        else store.undoMapping()
        return
      }

      const key = e.key
      if (key !== 'ArrowUp' && key !== 'ArrowDown' && key !== 'ArrowLeft' && key !== 'ArrowRight') {
        return
      }

      const { mappingSelection, nudgeStep } = useUiStore.getState()
      const base = NUDGE_STEPS.find((s) => s.id === nudgeStep)?.value ?? 0.01
      const step = e.shiftKey ? base * 5 : base
      const dx = key === 'ArrowLeft' ? -step : key === 'ArrowRight' ? step : 0
      const dy = key === 'ArrowDown' ? -step : key === 'ArrowUp' ? step : 0

      e.preventDefault()
      useLayersStore.getState().nudgeActiveCorners(dx, dy, selectionCornerIndices(mappingSelection))
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

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1')
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  const locked = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.locked ?? false)
  const toggleLocked = useLayersStore((s) => s.toggleActiveLocked)
  const rotate = useLayersStore((s) => s.rotateActiveCorners)
  const scale = useLayersStore((s) => s.scaleActiveCorners)
  const flip = useLayersStore((s) => s.flipActiveCorners)
  const straighten = useLayersStore((s) => s.straightenActiveCorners)
  const testPattern = useLayersStore((s) => s.testPattern)
  const setTestPattern = useLayersStore((s) => s.setTestPattern)

  const warp = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.warp)
  const warpActive = isWarpActive(warp)
  const mode = warpMode(warp)
  const gridCells = warp?.grid?.cols ?? GRID_DEFAULT_CELLS
  const resetWarp = useLayersStore((s) => s.resetActiveWarp)
  const setWarpMode = useLayersStore((s) => s.setActiveWarpMode)
  const setGridSize = useLayersStore((s) => s.setActiveGridSize)
  const keystone = useLayersStore((s) => s.keystoneActiveCorners)
  const undoMapping = useLayersStore((s) => s.undoMapping)
  const redoMapping = useLayersStore((s) => s.redoMapping)
  const canUndo = useLayersStore((s) => s.mappingPast.length > 0)
  const canRedo = useLayersStore((s) => s.mappingFuture.length > 0)

  const selection = useUiStore((s) => s.mappingSelection)
  const setSelection = useUiStore((s) => s.setMappingSelection)
  const editingWarp = useUiStore((s) => s.warpMode)
  const toggleWarpMode = useUiStore((s) => s.toggleWarpMode)
  const nudgeStep = useUiStore((s) => s.nudgeStep)
  const setNudgeStep = useUiStore((s) => s.setNudgeStep)
  const gridVisible = useUiStore((s) => s.gridVisible)
  const toggleGrid = useUiStore((s) => s.toggleGrid)
  const snapEnabled = useUiStore((s) => s.snapEnabled)
  const toggleSnap = useUiStore((s) => s.toggleSnap)

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-20">
      {/* toolbar piena: si comprime in altezza (grid-template-rows) e il contenuto si dissolve
          un po' prima di schiacciarsi — stessa tecnica di CollapsibleSection (§7 apple-design:
          entra ed esce lungo lo stesso percorso, non un semplice fade). */}
      <div
        className={cn(
          'grid overflow-hidden transition-[grid-template-rows] duration-[--dur-base] ease-[--ease-fluid]',
          collapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
        )}
      >
        <div
          className={cn(
            'pointer-events-auto flex min-h-0 flex-col gap-1.5 rounded-lg border border-white/10 bg-black/70 p-1.5 backdrop-blur-sm',
            'transition-opacity duration-[--dur-fast] ease-[--ease-out]',
            collapsed ? 'opacity-0' : 'opacity-100',
          )}
        >
          {/* riga 1: bersaglio delle frecce, passo dello spostamento e — spinto sull'estrema
              destra da justify-between — il tasto di riduzione, nell'angolo in alto ma dentro
              il riquadro invece che a cavallo del bordo */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Crosshair className="mx-0.5 size-3.5 shrink-0 text-white/40" />
              {SELECTION_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  type="button"
                  variant="ghost"
                  size="xs"
                  title={opt.title}
                  onClick={() => setSelection(opt.value)}
                  className={cn(
                    'min-w-8 px-1.5 tabular-nums',
                    sameSelection(selection, opt.value) ? PILL_ACTIVE_PURPLE : PILL_IDLE,
                  )}
                >
                  {opt.label}
                </Button>
              ))}

              {/* lati interi: le frecce muovono insieme i due angoli. Sul canvas si ottiene lo
                  stesso cliccando la maniglia a rombo al centro del lato */}
              {EDGE_OPTIONS.map(({ edge, Icon }) => {
                const value: MappingSelection = { kind: 'edge', edge }
                return (
                  <Button
                    key={edge}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    title={`${WARP_EDGE_LABELS[edge]}: le frecce muovono i due angoli insieme`}
                    aria-label={WARP_EDGE_LABELS[edge]}
                    onClick={() => setSelection(value)}
                    className={cn(sameSelection(selection, value) ? PILL_ACTIVE_PURPLE : PILL_IDLE)}
                  >
                    <Icon className="size-3.5" />
                  </Button>
                )
              })}

              <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

              {NUDGE_STEPS.map((step) => (
                <Button
                  key={step.id}
                  type="button"
                  variant="ghost"
                  size="xs"
                  title={`Passo delle frecce: ${step.label} (${step.value}). Shift = ×5`}
                  onClick={() => setNudgeStep(step.id)}
                  className={cn(
                    'px-1.5',
                    nudgeStep === step.id ? PILL_ACTIVE_WHITE : PILL_IDLE,
                  )}
                >
                  {step.label}
                </Button>
              ))}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Comprimi gli strumenti di mapping"
              aria-label="Comprimi gli strumenti di mapping"
              onClick={() => setCollapsed(true)}
              className={PILL_IDLE}
            >
              <Minimize2 className="size-3.5" />
            </Button>
          </div>

          {/* riga 2: trasformazioni del quad, blocco e riferimenti visivi */}
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Ruota di -90°"
              aria-label="Ruota di -90°"
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
              aria-label="Ruota di +90°"
              disabled={locked}
              onClick={() => rotate(-QUARTER_TURN)}
            >
              <RotateCw className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title="Rotazione fine: -1°"
              disabled={locked}
              onClick={() => rotate(FINE_ROTATION)}
              className={cn('px-1', PILL_IDLE)}
            >
              −1°
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title="Rotazione fine: +1°"
              disabled={locked}
              onClick={() => rotate(-FINE_ROTATION)}
              className={cn('px-1', PILL_IDLE)}
            >
              +1°
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            {/* scala non uniforme: adatta le proporzioni del quad a quelle reali dell'oggetto */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Allarga (larghezza). Alt+click per restringere"
              aria-label="Allarga (larghezza). Alt+click per restringere"
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
              aria-label="Allunga (altezza). Alt+click per accorciare"
              disabled={locked}
              onClick={(e) => scale(1, e.altKey ? 1 / SCALE_STEP : SCALE_STEP)}
            >
              <ChevronsUpDown className="size-3.5" />
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            {/* keystone: la correzione trapezoidale del proiettore fuori asse. Agisce sui corner
                come rotazione e scala, quindi resta compatibile col trascinamento delle maniglie */}
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title="Keystone verticale: allarga il lato alto. Alt+click per il basso"
              disabled={locked}
              onClick={(e) => keystone(0, e.altKey ? -KEYSTONE_STEP : KEYSTONE_STEP)}
              className={cn('px-1', PILL_IDLE)}
            >
              ⌃K
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              title="Keystone orizzontale: allunga il lato destro. Alt+click per il sinistro"
              disabled={locked}
              onClick={(e) => keystone(e.altKey ? -KEYSTONE_STEP : KEYSTONE_STEP, 0)}
              className={cn('px-1', PILL_IDLE)}
            >
              ⌐K
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Specchia in orizzontale"
              aria-label="Specchia in orizzontale"
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
              aria-label="Specchia in verticale"
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
              aria-label="Raddrizza: riporta i 4 angoli a rettangolo, mantenendo centro e dimensioni"
              disabled={locked}
              onClick={straighten}
            >
              <Square className="size-3.5" />
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            {/* deformazione: le maniglie compaiono sul canvas solo a modalità accesa, ma la
                deformazione già impostata resta applicata anche spegnendola */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Deforma la superficie: mostra le maniglie sul canvas (per statue, colonne, archi)"
              aria-label="Deforma la superficie: mostra le maniglie sul canvas (per statue, colonne, archi)"
              aria-pressed={editingWarp}
              onClick={toggleWarpMode}
              className={cn(editingWarp && 'text-cyan-400 hover:text-cyan-300')}
            >
              {mode === 'grid' ? <Grid2x2 className="size-3.5" /> : <Spline className="size-3.5" />}
            </Button>

            {/* scelta della modalità e, per il reticolo, della sua densità: visibili solo mentre
                si deforma, altrimenti la toolbar del live si allunga per niente */}
            {editingWarp && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  title="Curvatura dei bordi: 2 maniglie per lato, curve morbide"
                  onClick={() => setWarpMode('bezier')}
                  className={cn('px-1.5', mode === 'bezier' ? PILL_ACTIVE_CYAN : PILL_IDLE)}
                >
                  Bordi
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  title="Reticolo: nodi trascinabili anche all'interno della superficie"
                  onClick={() => setWarpMode('grid')}
                  className={cn('px-1.5', mode === 'grid' ? PILL_ACTIVE_CYAN : PILL_IDLE)}
                >
                  Reticolo
                </Button>
                {mode === 'grid' &&
                  GRID_SIZES.map((cells) => (
                    <Button
                      key={cells}
                      type="button"
                      variant="ghost"
                      size="xs"
                      title={`Reticolo ${cells + 1}×${cells + 1} nodi (la forma già data viene conservata)`}
                      disabled={locked}
                      onClick={() => setGridSize(cells, cells)}
                      className={cn(
                        'px-1.5 tabular-nums',
                        gridCells === cells ? PILL_ACTIVE_WHITE : PILL_IDLE,
                      )}
                    >
                      {cells + 1}²
                    </Button>
                  ))}
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Azzera la deformazione della modalità attiva e la correzione dell'obiettivo (corner e posizione restano)"
              aria-label="Azzera la deformazione della modalità attiva e la correzione dell'obiettivo"
              disabled={locked || !warpActive}
              onClick={resetWarp}
            >
              <Eraser className="size-3.5" />
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            {/* annulla/ripeti del solo mapping: allineare è lento e delicato, e fino a ora un
                drag sbagliato non si poteva disfare */}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Annulla l'ultima modifica di mapping (⌘Z / Ctrl+Z)"
              aria-label="Annulla l'ultima modifica di mapping"
              disabled={!canUndo}
              onClick={undoMapping}
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Ripeti la modifica annullata (⇧⌘Z / Ctrl+Shift+Z)"
              aria-label="Ripeti la modifica annullata"
              disabled={!canRedo}
              onClick={redoMapping}
            >
              <Redo2 className="size-3.5" />
            </Button>

            <Separator orientation="vertical" className="mx-0.5 h-5 bg-white/15" />

            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Mostra la griglia di allineamento"
              aria-label="Mostra la griglia di allineamento"
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
              aria-label="Aggancia gli angoli alla griglia mentre li trascini"
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
              aria-label="Test pattern di calibrazione"
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
              aria-label={locked ? 'Mapping bloccato: sbloccalo per modificarlo' : 'Blocca il mapping'}
              aria-pressed={locked}
              onClick={toggleLocked}
              className={cn(locked && 'text-amber-400 hover:text-amber-300')}
            >
              {locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* pillola quando compressa: stessa posizione di ancoraggio del riquadro pieno, si
          materializza dal suo angolo invece di comparire al centro (§7 apple-design). La durata
          di transizione è tutta dichiarata qui (non lasciata a `transition-all` del componente
          Button) perché deve coprire anche l'opacità, non solo i colori. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        title="Mostra gli strumenti di mapping"
        aria-label="Mostra gli strumenti di mapping"
        onClick={() => setCollapsed(false)}
        className={cn(
          'absolute bottom-0 left-0 origin-bottom-left rounded-lg border border-white/10 bg-black/70 text-white/70 backdrop-blur-sm',
          'transition-[opacity,transform,background-color,color] duration-[--dur-base] ease-[--ease-fluid]',
          'hover:bg-white/10 hover:text-white',
          collapsed
            ? 'pointer-events-auto scale-100 opacity-100 delay-100'
            : 'pointer-events-none scale-90 opacity-0',
        )}
      >
        <Maximize2 className="size-4" />
      </Button>
    </div>
  )
}
