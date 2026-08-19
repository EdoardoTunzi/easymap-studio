import * as THREE from 'three'

/**
 * Ingresso audio per gli shader audio-reattivi.
 *
 * Volutamente minimo: **un solo ingresso condiviso da tutta l'app**, un `AnalyserNode`, e la
 * forma d'onda copiata ogni frame in una texture 256×1 che gli shader leggono con
 * `easyvj_wave()` (vedi il wrapper in `isfParser.ts`). Niente FFT a bande, niente beat
 * detection, niente catena di effetti: la ricchezza sta nei parametri dell'effetto, non qui.
 *
 * L'audio non viene mai collegato alla destinazione del contesto: si analizza soltanto, non si
 * riproduce — altrimenti un microfono aperto sulle casse del locale darebbe un Larsen immediato.
 *
 * Come per le camere, ogni finestra (Control e Output) apre il proprio ingresso: uno stream non
 * attraversa il `BroadcastChannel`. In Output l'attivazione è automatica quando la scena
 * contiene un effetto audio-reattivo (vedi `use-audio-autostart.ts`).
 */

/** Campioni nel dominio del tempo, e larghezza della texture letta dagli shader. */
const SAMPLES = 256

/** 128 = silenzio nella codifica a byte di `getByteTimeDomainData`. */
const SILENCE = 128

let context: AudioContext | null = null
let analyser: AnalyserNode | null = null
let stream: MediaStream | null = null
let level = 0
/** Ultimo istante campionato: il tick arriva da ogni layer, ma va eseguito una volta per frame. */
let lastTick = -1

const samples = new Uint8Array(SAMPLES)
const pixels = new Uint8Array(SAMPLES * 4).fill(SILENCE)

const texture = new THREE.DataTexture(pixels, SAMPLES, 1, THREE.RGBAFormat)
texture.minFilter = THREE.LinearFilter
texture.magFilter = THREE.LinearFilter
// la finestra visualizzata può scorrere oltre il bordo: meglio che si richiuda su sé stessa
texture.wrapS = THREE.RepeatWrapping
texture.needsUpdate = true

export interface AudioState {
  active: boolean
  error: string | null
}

let state: AudioState = { active: false, error: null }
const listeners = new Set<() => void>()

function setState(next: AudioState) {
  state = next
  for (const listener of listeners) listener()
}

/** Sottoscrizione per la UI (usata con `useSyncExternalStore`). */
export function subscribeAudio(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getAudioState(): AudioState {
  return state
}

export function isAudioActive(): boolean {
  return state.active
}

export function getAudioTexture(): THREE.DataTexture {
  return texture
}

/** Volume RMS dell'ultimo frame (0..1). */
export function getAudioLevel(): number {
  return level
}

/** Riporta la texture al silenzio: senza, resterebbe visibile l'ultima forma d'onda letta. */
function clearWaveform() {
  pixels.fill(SILENCE)
  for (let i = 3; i < pixels.length; i += 4) pixels[i] = 255
  texture.needsUpdate = true
  level = 0
}

export async function startAudio(): Promise<void> {
  if (state.active) return
  try {
    // le elaborazioni "da chiamata vocale" mangiano proprio ciò che serve qui (dinamica e
    // transienti della musica), quindi si chiedono spente
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      video: false,
    })
    context = new AudioContext()
    // il contesto nasce sospeso se la pagina non ha ancora avuto interazione
    await context.resume().catch(() => {})
    analyser = context.createAnalyser()
    analyser.fftSize = SAMPLES // getByteTimeDomainData riempie esattamente fftSize campioni
    context.createMediaStreamSource(stream).connect(analyser)
    setState({ active: true, error: null })
  } catch (err) {
    stopAudio()
    setState({ active: false, error: audioErrorMessage(err) })
    throw err
  }
}

export function stopAudio() {
  analyser?.disconnect()
  analyser = null
  if (stream) {
    for (const track of stream.getTracks()) track.stop()
    stream = null
  }
  void context?.close().catch(() => {})
  context = null
  clearWaveform()
  if (state.active) setState({ active: false, error: null })
}

/**
 * Legge un frame di forma d'onda. Chiamata da ogni layer che renderizza, quindi si protegge da
 * sé: il campionamento avviene una volta sola per frame.
 */
export function tickAudio(elapsed: number) {
  if (!analyser || elapsed === lastTick) return
  lastTick = elapsed
  analyser.getByteTimeDomainData(samples)
  let sum = 0
  for (let i = 0; i < SAMPLES; i++) {
    const v = samples[i]
    pixels[i * 4] = v
    pixels[i * 4 + 1] = v
    pixels[i * 4 + 2] = v
    const centered = (v - SILENCE) / SILENCE
    sum += centered * centered
  }
  // attacco immediato, rilascio lento: i transienti (il kick) devono passare intatti, mentre
  // la discesa va smorzata — un livello che sobbalza a ogni frame fa "pompare" tutto ciò che
  // ci si aggancia, a partire dalla normalizzazione dell'oscilloscopio
  const rms = Math.min(1, Math.sqrt(sum / SAMPLES) * 1.8)
  level = rms > level ? rms : level * 0.92 + rms * 0.08
  texture.needsUpdate = true
}

export function audioErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | undefined)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return "Accesso al microfono negato dal browser o dal sistema."
  if (name === 'NotFoundError') return 'Nessun ingresso audio disponibile.'
  if (name === 'NotReadableError') return 'Ingresso audio occupato da un altro programma.'
  return (err as { message?: string } | undefined)?.message ?? "Impossibile aprire l'ingresso audio."
}

// L'ingresso aperto vive in questo modulo: un hot-replace lo lascerebbe orfano (microfono
// acceso e nessuno che lo legge), quindi in sviluppo si forza il reload completo.
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
