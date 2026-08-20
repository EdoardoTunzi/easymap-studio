import { useEffect } from 'react'
import { useLayersStore } from '../store/layersStore'
import { useEffectsStore } from '../store/effectsStore'
import { startAudio, stopAudio } from '../engine/audioInput'

/**
 * Apre l'ingresso audio quando la scena contiene un effetto audio-reattivo, e lo chiude quando
 * non ce ne sono più. Va montato **solo nella finestra Output**: lì non c'è UI per accendere
 * niente, e uno stream non attraversa il BroadcastChannel, quindi la finestra deve procurarsi
 * l'audio da sé. Nel Control l'attivazione resta manuale (un microfono non si apre a sorpresa).
 *
 * Il permesso è già stato concesso all'origine dalla finestra di Controllo, quindi qui non
 * compare alcuna richiesta. Se il contesto audio nasce sospeso perché la finestra non ha ancora
 * ricevuto un click, basta interagirci una volta (o metterla a schermo intero) per farlo partire.
 */
export function useAudioAutoStart() {
  const needed = useLayersStore((s) => {
    const shaders = useEffectsStore.getState().shaders
    return s.layers.some(
      (l) => l.visible && shaders.find((sh) => sh.name === l.shaderName)?.usesAudio,
    )
  })

  useEffect(() => {
    if (needed) void startAudio().catch(() => {})
    else stopAudio()
  }, [needed])
}
