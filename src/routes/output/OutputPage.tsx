import { useEffect, useState } from 'react'
import { StageCanvas } from '../../engine/StageCanvas'
import { OutputStats } from '../../components/Output/OutputStats'
import { useBroadcastSubscriber } from '../../lib/sync'
import { useAudioAutoStart } from '../../hooks/use-audio-autostart'
import { useRenderStore } from '../../store/renderStore'

/** Quanto resta a schermo il promemoria dei comandi, all'apertura della finestra. */
const HINT_MS = 6000

/**
 * Pieno schermo, riportando il motivo di un eventuale rifiuto.
 *
 * Il browser lo nega in più di un caso (nessun gesto dell'utente alle spalle, pagina dentro un
 * frame che non lo concede): ingoiare l'errore lascerebbe chi sta tarando la proiezione a premere
 * un tasto che non fa niente, senza sapere perché. Meglio dirlo, e dire cosa fare al suo posto.
 */
const FULLSCREEN_DENIED =
  'Il browser non ha concesso il pieno schermo: usa quello della finestra (su macOS ⌃⌘F). I pixel realmente proiettati sono quelli del pannello diagnostico (S).'

function toggleFullscreen(onError: (message: string) => void) {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {})
    return
  }
  // Si controlla lo STATO, non l'esito della promise: la richiesta può fallire in silenzio —
  // promise né rifiutata né seguita da un cambio di stato — quando la pagina sta dentro un frame
  // che non concede il permesso. Fidarsi del solo `catch` lascerebbe un tasto che a schermo non
  // fa niente e non dice niente, che sul palco è il modo peggiore di fallire.
  const report = () => {
    if (!document.fullscreenElement) onError(FULLSCREEN_DENIED)
  }
  document.documentElement.requestFullscreen().then(report, report)
  setTimeout(report, 500)
}

export function OutputPage() {
  useBroadcastSubscriber()
  // gli effetti audio-reattivi hanno bisogno dell'ingresso anche qui: la finestra se lo apre
  // da sola quando la scena ne contiene uno (uno stream non passa dal BroadcastChannel)
  useAudioAutoStart()

  const stats = useRenderStore((s) => s.stats)
  const [hint, setHint] = useState(true)
  /** Messaggio di rifiuto del pieno schermo: resta a schermo finché non si preme di nuovo. */
  const [notice, setNotice] = useState<string | null>(null)

  /*
   * Comandi locali della finestra proiettata. Il pieno schermo **non** si può comandare dal
   * Control: il browser lo concede solo a chi ha ricevuto un gesto dell'utente nella finestra che
   * lo chiede, quindi vive per forza qui. Restano due tasti da ricordare, e li scriviamo a schermo
   * per i primi secondi.
   */
  useEffect(() => {
    const timer = setTimeout(() => setHint(false), HINT_MS)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    // si guarda `key` prima di `code`: qui il tasto è quello che *stampa* la lettera scritta nel
    // promemoria a schermo, e su una tastiera non italiana la posizione fisica non coincide
    const pressed = (e: KeyboardEvent, letter: string) =>
      e.key.toLowerCase() === letter || e.code === `Key${letter.toUpperCase()}`

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (pressed(e, 'f')) {
        e.preventDefault()
        setNotice(null)
        toggleFullscreen(setNotice)
        setHint(false)
        return
      }
      if (pressed(e, 's')) {
        e.preventDefault()
        const store = useRenderStore.getState()
        store.set({ stats: !store.stats })
        return
      }
      // il cartello si accende anche da qui: chi tara la proiezione sta davanti al proiettore,
      // non davanti al portatile, e deve poter accendere e spegnere il riferimento da lì
      if (pressed(e, 'c')) {
        e.preventDefault()
        const store = useRenderStore.getState()
        store.set({ qualityCard: !store.qualityCard })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      className="relative h-full w-full"
      onDoubleClick={() => {
        setNotice(null)
        toggleFullscreen(setNotice)
        setHint(false)
      }}
    >
      <StageCanvas role="output" />
      {stats && <OutputStats />}
      {notice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 max-w-md -translate-x-1/2 select-none rounded-lg border border-amber-400/30 bg-black/80 px-4 py-2 text-center font-mono text-[11px] leading-relaxed text-amber-300/90 backdrop-blur-sm">
          {notice}
        </div>
      )}
      {hint && !stats && !notice && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-50 -translate-x-1/2 select-none rounded-full border border-white/10 bg-black/70 px-4 py-1.5 font-mono text-[11px] text-white/60 backdrop-blur-sm">
          F o doppio click = pieno schermo · S = diagnostica · C = cartello di prova
        </div>
      )}
    </div>
  )
}
