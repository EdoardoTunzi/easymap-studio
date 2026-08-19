/**
 * Ingressi video live (webcam, capture card HDMI, cam USB) come sorgente di un layer.
 *
 * Gli stream sono condivisi per deviceId con conteggio dei riferimenti: più layer possono
 * riprendere la STESSA camera — è così che si stratificano più effetti sulla stessa ripresa —
 * senza riaprire il device ogni volta. Il rilascio è ritardato perché un cambio di scena smonta
 * i vecchi layer prima di montare i nuovi: spegnere e riaccendere la camera nel mezzo
 * costerebbe un lampo nero (e il tempo di aggancio del device).
 *
 * Ogni finestra (Control e Output) ha la sua cache e apre la camera per conto proprio: un
 * MediaStream non è serializzabile, quindi via BroadcastChannel viaggia solo il deviceId.
 */

export interface CameraDevice {
  deviceId: string
  label: string
}

/** Attesa prima di spegnere davvero una camera senza più layer che la usano. */
const RELEASE_MS = 4000

/** Preferenza di formato: si prende il massimo che il device offre fino al 1080p. */
const IDEAL: MediaTrackConstraints = { width: { ideal: 1920 }, height: { ideal: 1080 } }

interface StreamEntry {
  /** Quanti consumatori (controller di texture, probe della UI) lo stanno usando. */
  refs: number
  promise: Promise<MediaStream>
  /** Stream risolto, per poterne controllare la salute senza aspettare la promise. */
  stream: MediaStream | null
  /** Spegnimento ritardato in corso (nessun riferimento attivo, ma lo stream è ancora aperto). */
  release: ReturnType<typeof setTimeout> | null
}

const streams = new Map<string, StreamEntry>()

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) track.stop()
}

/** Uno stream i cui track sono tutti terminati è carta straccia: va riaperto, non riusato. */
function isAlive(stream: MediaStream): boolean {
  return stream.getVideoTracks().some((t) => t.readyState === 'live')
}

export function cameraSupported(): boolean {
  return typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia != null
}

/**
 * Camere disponibili. Prima del consenso il browser restituisce voci senza etichetta (e su
 * alcuni sistemi una sola voce generica): l'elenco completo arriva dopo il primo getUserMedia.
 */
export async function listCameras(): Promise<CameraDevice[]> {
  if (!cameraSupported()) return []
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }))
}

/**
 * Apertura vera del device.
 *
 * Il vincolo è `exact`: con `ideal` il browser è libero di ignorarlo e restituire la camera che
 * ha già aperto, e cambiare sorgente dalla tendina non farebbe nulla (il layer resterebbe sulla
 * camera precedente). Il prezzo di `exact` è l'errore quando quell'id non esiste più — cam
 * staccata, id invalidato da un reset dei permessi — e lì si ripiega su una camera qualsiasi:
 * meglio l'immagine sbagliata che un layer spento a metà serata.
 */
async function openDevice(deviceId: string): Promise<MediaStream> {
  const anyCamera = { video: IDEAL, audio: false }
  if (!deviceId) return navigator.mediaDevices.getUserMedia(anyCamera)
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId }, ...IDEAL },
      audio: false,
    })
  } catch (err) {
    const name = (err as { name?: string } | undefined)?.name
    if (name === 'OverconstrainedError' || name === 'NotFoundError') {
      return navigator.mediaDevices.getUserMedia(anyCamera)
    }
    throw err
  }
}

/** L'errore dice che il device è occupato (tipicamente banda USB o un'altra app che lo tiene). */
export function isCameraBusyError(err: unknown): boolean {
  const name = (err as { name?: string } | undefined)?.name
  return name === 'NotReadableError' || name === 'AbortError'
}

/**
 * Apre (o riusa) lo stream di un device. `deviceId` vuoto = camera di sistema predefinita.
 * Chi la ottiene deve chiamare `releaseCameraStream` con la stessa chiave.
 */
export function acquireCameraStream(deviceId: string): Promise<MediaStream> {
  if (!cameraSupported()) return Promise.reject(new Error('Questo browser non espone le camere.'))

  let entry = streams.get(deviceId)
  if (entry?.release != null) {
    clearTimeout(entry.release)
    entry.release = null
  }
  // stream morto in cache (cam scollegata, sospensione del sistema, device preso da un altro
  // programma): riusarlo darebbe un'immagine congelata per sempre, quindi si riapre da capo
  if (entry?.stream && !isAlive(entry.stream)) {
    streams.delete(deviceId)
    entry = undefined
  }
  if (!entry) {
    const promise = openDevice(deviceId)
      .then((stream) => {
        const current = streams.get(deviceId)
        // rilasciata mentre il browser chiedeva il consenso: non lasciare la camera accesa
        if (current?.promise !== promise) stopStream(stream)
        else current.stream = stream
        return stream
      })
    entry = { refs: 0, promise, stream: null, release: null }
    streams.set(deviceId, entry)
    // un tentativo fallito (permesso negato, device occupato) non deve restare in cache:
    // il prossimo acquire deve poter riprovare davvero
    promise.catch(() => {
      if (streams.get(deviceId)?.promise === promise) streams.delete(deviceId)
    })
  }
  entry.refs++
  return entry.promise
}

/**
 * Chiude subito lo stream di un device e lo toglie dalla cache, senza attese: serve al riavvio
 * manuale (“la camera si è piantata a metà set”) e al recupero automatico quando un track muore.
 * I riferimenti in giro diventano no-op, il prossimo acquire riapre il device da zero.
 */
export function dropCameraStream(deviceId: string) {
  const entry = streams.get(deviceId)
  if (!entry) return
  if (entry.release != null) clearTimeout(entry.release)
  streams.delete(deviceId)
  entry.promise.then(stopStream).catch(() => {})
}

/** Rilascia un riferimento; l'ultimo spegne la camera dopo `RELEASE_MS`. */
export function releaseCameraStream(deviceId: string) {
  const entry = streams.get(deviceId)
  if (!entry) return
  entry.refs--
  if (entry.refs > 0 || entry.release != null) return
  entry.release = setTimeout(() => {
    const current = streams.get(deviceId)
    if (!current || current.refs > 0) return
    streams.delete(deviceId)
    current.promise.then(stopStream).catch(() => {})
  }, RELEASE_MS)
}

/**
 * Apre la camera e ne riporta identità e formato reale: serve alla UI per registrare il media
 * del layer (dimensioni per il fit, etichetta, deviceId effettivo quando si è chiesta la
 * predefinita). Lo stream resta aperto: chiamare `releaseCameraStream(result.deviceId)` — o
 * lasciarlo prendere in carico dal layer, che lo acquisisce subito dopo.
 */
export async function openCamera(
  deviceId = '',
): Promise<{ deviceId: string; label: string; width: number; height: number }> {
  const stream = await acquireCameraStream(deviceId)
  const track = stream.getVideoTracks()[0]
  const settings = track?.getSettings() ?? {}
  const realId = settings.deviceId ?? deviceId
  // Chiedendo la camera predefinita la chiave in cache è '' ma il layer memorizza il deviceId
  // reale. Il riferimento va spostato sotto quella chiave, altrimenti il layer che monta subito
  // dopo aprirebbe una seconda volta lo stesso device fisico.
  if (realId !== deviceId) {
    const existing = streams.get(realId)
    if (existing) {
      // quella camera è già aperta (un altro layer la usa): ci si aggancia
      if (existing.release != null) {
        clearTimeout(existing.release)
        existing.release = null
      }
      existing.refs++
      releaseCameraStream(deviceId)
    } else {
      const entry = streams.get(deviceId)
      // stessa entry, nuova chiave: nessuna riapertura e conteggio invariato
      if (entry) {
        streams.delete(deviceId)
        streams.set(realId, entry)
      }
    }
  }
  return {
    deviceId: realId,
    label: track?.label || 'Camera',
    width: settings.width ?? 1280,
    height: settings.height ?? 720,
  }
}

/** Messaggio leggibile per i fallimenti tipici di getUserMedia. */
export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | undefined)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Accesso alla camera negato dal browser o dal sistema.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError')
    return 'Il browser non trova nessuna camera utilizzabile.'
  if (name === 'NotReadableError')
    return 'Camera occupata da un altro programma (o da un\'altra finestra di questa app).'
  return (err as { message?: string } | undefined)?.message ?? 'Impossibile aprire la camera.'
}

/** Quadro dell'ambiente al momento di un fallimento: serve a distinguere le cause fra loro. */
export interface CameraDiagnostics {
  /** Contesto sicuro (https o localhost). Senza, `navigator.mediaDevices` non esiste nemmeno. */
  secure: boolean
  origin: string
  /** Permesso secondo il browser: granted / denied / prompt (n/d dove la query non è supportata). */
  permission: string
  /** Quante camere vede il browser in questo momento. */
  count: number
  /** Nome tecnico dell'errore (NotAllowedError, NotReadableError, …). */
  errorName: string
  /** Cosa fare, dedotto dal quadro complessivo. */
  hint: string
}

/**
 * Fotografa lo stato di ambiente e permessi. Serve perché "la camera non si attiva" nasconde
 * quattro cause diverse — pagina non sicura, permesso bloccato, device occupato, nessuna camera —
 * che dal solo messaggio di errore del browser non si distinguono.
 */
export async function cameraDiagnostics(err?: unknown): Promise<CameraDiagnostics> {
  const secure = typeof window !== 'undefined' && window.isSecureContext
  const origin = typeof location !== 'undefined' ? location.origin : ''
  let permission = 'n/d'
  try {
    const status = await navigator.permissions?.query({ name: 'camera' as PermissionName })
    if (status) permission = status.state
  } catch {
    /* Firefox e Safari non espongono la query per la camera: resta 'n/d' */
  }
  const count = (await listCameras().catch(() => [])).length
  const errorName = (err as { name?: string } | undefined)?.name ?? ''

  let hint: string
  if (!secure) {
    hint =
      'La pagina non è in un contesto sicuro: apri l\'app da http://localhost:PORTA (non dall\'indirizzo IP della rete) oppure servila in https.'
  } else if (permission === 'denied') {
    hint =
      'Il permesso è bloccato per questo sito: clicca l\'icona della camera (o del lucchetto) nella barra degli indirizzi, scegli “Consenti”, poi ricarica la pagina.'
  } else if (errorName === 'NotReadableError') {
    hint =
      'Il device è occupato: chiudi Zoom/Meet/Photo Booth/OBS e le altre schede o finestre di questa app che stanno usando la camera, poi riprova.'
  } else if (count === 0) {
    hint =
      'Il browser non vede nessuna camera. Su macOS controlla Impostazioni di sistema → Privacy e sicurezza → Fotocamera e verifica che il browser sia autorizzato (dopo averlo attivato va riavviato).'
  } else {
    hint = 'Riprova; se il problema resta, ricarica la pagina e riapri il pannello.'
  }
  return { secure, origin, permission, count, errorName, hint }
}

// Lo stato delle camere aperte vive in questo modulo: un hot-replace in sviluppo lascerebbe
// stream orfani (immagine congelata sul layer, device ancora occupato) mentre i componenti già
// montati continuano a parlare con la versione vecchia. Meglio un reload completo della pagina.
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
