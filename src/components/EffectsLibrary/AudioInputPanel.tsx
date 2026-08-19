import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Mic, MicOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getAudioLevel,
  getAudioState,
  startAudio,
  stopAudio,
  subscribeAudio,
} from '@/engine/audioInput'

/**
 * Attivazione dell'ingresso audio, mostrata solo quando l'effetto selezionato è audio-reattivo:
 * il microfono non serve a nessun altro effetto della libreria, e chiederlo altrove sarebbe
 * rumore nell'interfaccia.
 *
 * L'indicatore di livello legge il volume direttamente in un rAF invece di passare dallo stato
 * React: aggiornarlo sessanta volte al secondo attraverso uno store farebbe ri-renderizzare
 * mezzo pannello a ogni frame.
 */
export function AudioInputPanel() {
  const state = useSyncExternalStore(subscribeAudio, getAudioState)
  const [busy, setBusy] = useState(false)
  const meterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!state.active) return
    let raf = 0
    const step = () => {
      const bar = meterRef.current
      if (bar) bar.style.transform = `scaleX(${Math.min(1, getAudioLevel() * 1.4)})`
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [state.active])

  const toggle = async () => {
    if (state.active) {
      stopAudio()
      return
    }
    setBusy(true)
    try {
      await startAudio()
    } catch {
      /* il messaggio arriva dallo stato condiviso */
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Ingresso audio
        </span>
        {state.active && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
            in ascolto
          </span>
        )}
      </div>

      <Button
        variant={state.active ? 'default' : 'outline'}
        size="sm"
        className="h-7 w-full gap-1.5 px-2 text-xs"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {state.active ? <MicOff className="size-3.5 shrink-0" /> : <Mic className="size-3.5 shrink-0" />}
        {state.active ? 'Chiudi ingresso' : busy ? 'Apertura…' : 'Attiva microfono / linea'}
      </Button>

      {/* barra di livello: conferma a colpo d'occhio che sta entrando davvero del segnale */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          ref={meterRef}
          className="h-full origin-left rounded-full bg-emerald-400"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {state.error && <p className="text-[11px] leading-relaxed text-red-400">{state.error}</p>}

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Questo effetto disegna il suono in ingresso. L'audio viene solo analizzato, mai
        registrato né riprodotto. Per il proiettore non serve fare nulla: la finestra Output apre
        l'ingresso da sé quando la scena contiene un effetto audio-reattivo.
      </p>
    </div>
  )
}
