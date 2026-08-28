import { useState } from 'react'
import { MonitorPlay, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { ControlRow } from '@/components/layout/ControlRow'
import { MAX_GRAIN, SUPER_SAMPLE_STEPS, useRenderStore } from '@/store/renderStore'

/**
 * Window Management API: dice quali schermi ci sono e dove stanno nel desktop virtuale, così la
 * finestra di proiezione può nascere già sul proiettore invece che sopra il pannello di controllo.
 * Non è nei tipi standard del DOM, e non tutti i browser la espongono.
 */
interface ScreenInfo {
  availLeft: number
  availTop: number
  availWidth: number
  availHeight: number
  isPrimary: boolean
  label: string
}
interface ScreenDetails {
  screens: ScreenInfo[]
  currentScreen: ScreenInfo
}
type WindowWithScreens = Window & { getScreenDetails?: () => Promise<ScreenDetails> }

function openOutputWindow(screen?: ScreenInfo) {
  const features = screen
    ? `left=${screen.availLeft},top=${screen.availTop},width=${screen.availWidth},height=${screen.availHeight},menubar=no,toolbar=no,location=no`
    : 'width=1920,height=1080,menubar=no,toolbar=no,location=no'
  return window.open('/output', 'easyvj-output', features)
}

/**
 * Riga di un interruttore: nome, una riga che dice cosa fa, e lo Switch a destra.
 *
 * L'etichetta è in maiuscolo iniziale come nel resto dell'app: il maiuscoletto resta ai titoli di
 * sezione, altrimenti ogni voce griderebbe quanto il titolo che la contiene (§15).
 */
function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="ui-sublabel text-foreground/90">{label}</span>
        <span className="ui-sublabel font-normal leading-snug text-muted-foreground/80">
          {description}
        </span>
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="shrink-0" />
    </label>
  )
}

export function OutputLauncher() {
  const render = useRenderStore()
  const [note, setNote] = useState<string | null>(null)

  const openOutput = async () => {
    const api = window as WindowWithScreens
    // senza l'API (o senza permesso) resta l'apertura semplice: va trascinata a mano sul proiettore
    if (!api.getScreenDetails) {
      openOutputWindow()
      setNote('Trascina la finestra sul proiettore e premi F per il pieno schermo.')
      return
    }
    try {
      const details = await api.getScreenDetails()
      const target = details.screens.find((s) => !s.isPrimary) ?? details.currentScreen
      openOutputWindow(target)
      setNote(
        details.screens.length > 1
          ? `Aperta su “${target.label || 'schermo secondario'}”. Premi F sulla finestra per il pieno schermo.`
          : 'Un solo schermo rilevato: collega il proiettore e riapri la finestra.',
      )
    } catch {
      openOutputWindow()
      setNote('Permesso schermi non concesso: trascina la finestra sul proiettore e premi F.')
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">Finestra di proiezione</span>
        <Button onClick={openOutput} className="press w-full gap-2">
          <MonitorPlay data-icon="inline-start" />
          Apri finestra Output
        </Button>
        <p className="ui-sublabel leading-relaxed text-muted-foreground/80">
          {note ??
            'Si apre sullo schermo secondario, se ce n’è uno. Sulla finestra: F o doppio click per il pieno schermo, S per la diagnostica, C per il cartello di prova.'}
        </p>
      </div>

      {/* -mx-4: il divisorio arriva ai bordi del pannello, come nelle altre colonne */}
      <div className="-mx-4 border-t border-sidebar-border/60" />

      <div className="flex items-center justify-between gap-2">
        <span className="ui-eyebrow text-muted-foreground">Qualità immagine</span>
        <Button
          variant="ghost"
          size="sm"
          className="press text-muted-foreground"
          onClick={() => useRenderStore.getState().reset()}
          title="Riporta le impostazioni di resa ai valori di partenza"
        >
          <RotateCcw data-icon="inline-start" />
          Ripristina
        </Button>
      </div>

      <ControlRow
        label="Supersampling"
        value={`${render.superSample}×`}
        hint="Disegna più grande di quanto proietta e riduce: è l'unico antialiasing che agisce sui contorni disegnati dagli shader e sul bordo della sagoma. Il costo cresce col quadrato (2× sono quattro volte i pixel), ma sul vsync non si sente. La scala si ferma a 2× perché oltre, provato sul proiettore, la nitidezza non migliora: lì il limite è l'ottica. Vale solo per la finestra Output, non per questa anteprima."
      >
        <ToggleGroup
          type="single"
          className="w-full"
          value={String(render.superSample)}
          onValueChange={(v) => v && render.set({ superSample: Number(v) })}
        >
          {SUPER_SAMPLE_STEPS.map((step) => (
            <ToggleGroupItem
              key={step.value}
              value={String(step.value)}
              className="flex-1"
              title={step.hint}
            >
              {step.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </ControlRow>

      <ControlRow
        label="Sfondamento morbido"
        value={render.rolloff <= 0 ? 'taglio netto' : render.rolloff.toFixed(2)}
        hint="Quando i blend Add/Screen superano il fondo scala, l'eccesso vira verso il bianco invece di far scivolare la tinta (un rosso che sfonda diventerebbe giallo). Non tocca nulla che stia già dentro il range: il bianco pieno resta pieno, nessun lumen buttato."
      >
        <Slider
          min={0}
          max={1}
          step={0.01}
          value={[render.rolloff]}
          onValueChange={([v]) => render.set({ rolloff: v })}
        />
      </ControlRow>

      <ControlRow
        label="Grana"
        value={render.grain <= 0 ? 'off' : render.grain.toFixed(3)}
        hint="Un filo di rumore in movimento. Un video ha dettaglio fine ovunque, uno shader no: la grana riavvicina le due cose e nasconde quel che resta del banding."
      >
        <Slider
          min={0}
          max={MAX_GRAIN}
          step={0.002}
          value={[render.grain]}
          onValueChange={([v]) => render.set({ grain: v })}
        />
      </ControlRow>

      <ToggleRow
        label="Dithering"
        description="Toglie il banding dai gradienti"
        checked={render.dither}
        onCheckedChange={(v) => render.set({ dither: v })}
      />

      <ToggleRow
        label="Buffer HDR"
        description="Mezza precisione float: niente clipping nei blend"
        checked={render.hdr}
        onCheckedChange={(v) => render.set({ hdr: v })}
      />

      <div className="-mx-4 border-t border-sidebar-border/60" />

      <ToggleRow
        label="Pannello diagnostico"
        description="Risoluzione reale e fps sulla finestra Output"
        checked={render.stats}
        onCheckedChange={(v) => render.set({ stats: v })}
      />

      <ToggleRow
        label="Cartello di prova"
        description="Copre la scena su tutte le finestre"
        checked={render.qualityCard}
        onCheckedChange={(v) => render.set({ qualityCard: v })}
      />
      {render.qualityCard && (
        <p className="-mt-2 text-xs leading-relaxed text-muted-foreground">
          Dall'alto: righe da <strong className="font-medium text-foreground/80">un pixel</strong> —
          se non si leggono nette non stai proiettando alla risoluzione nativa (finestra non a pieno
          schermo, scaling del sistema, keystone del proiettore acceso). Poi la{' '}
          <strong className="font-medium text-foreground/80">rampa</strong>: se vedi strisce è
          banding, alza il dithering. Le <strong className="font-medium text-foreground/80">barre
          sature</strong> escono a fondo scala per costruzione: se sembrano slavate è la modalità
          immagine del proiettore. In basso i{' '}
          <strong className="font-medium text-foreground/80">gradini</strong> di nero e di bianco:
          quanti ne distingui è il contrasto reale della sala.
        </p>
      )}
    </div>
  )
}
