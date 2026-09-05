/**
 * Progetto come **file**: la stessa scena che vive in IndexedDB, resa un JSON che si scarica,
 * si manda a qualcuno e si riapre su un altro computer.
 *
 * `StoredProject` è già la forma canonica del progetto, quindi qui non si ridefinisce niente: si
 * traducono solo le due cose che JSON non sa rappresentare.
 *
 * 1. **I blob dei media → base64.** È il motivo per cui il file "include gli asset": senza, un
 *    progetto esportato arriverebbe a destinazione senza immagini. Costa il 33% in più di byte,
 *    che è il prezzo di avere un file solo e leggibile invece di un archivio.
 * 2. **L'handle della cartella delle playlist di asset → via.** `FileSystemDirectoryHandle` è
 *    structured-clonable (IndexedDB lo accetta) ma non è JSON, e soprattutto non avrebbe senso
 *    altrove: è un riferimento a una cartella di *questo* computer. Restano `dirName` e l'elenco
 *    dei file, così a destinazione si vede quale cartella cercare e la si ricollega a mano.
 *
 * Il modulo non tocca il DOM né IndexedDB: si limita a convertire avanti e indietro. Così la
 * conversione e la validazione girano anche fuori dal browser (vedi `projectFile.check.ts`).
 */

import type { EffectPreset, StoredMedia, StoredProject } from './persistence'
import type { Corner, Corners } from '../store/projectStore'

/** Marcatore del formato: distingue un progetto da un JSON qualsiasi trascinato per sbaglio. */
export const PROJECT_FILE_FORMAT = 'easymap-studio/project'
/** Versione dello *schema del file*, da alzare solo se un file vecchio smette di essere leggibile. */
export const PROJECT_FILE_VERSION = 1

/**
 * I preset sono una libreria **globale**, non una proprietà del progetto: si esportano in un file
 * loro, non dentro il progetto. Infilarli lì dentro significherebbe ritrovarsi la libreria di
 * qualcun altro mescolata alla propria solo per aver aperto la sua scena.
 */
export const PRESETS_FILE_FORMAT = 'easymap-studio/presets'
export const PRESETS_FILE_VERSION = 1

/** Media dentro il file: il blob diventa base64 + il suo MIME, il resto passa com'è. */
export interface ExportedMedia extends Omit<StoredMedia, 'blob'> {
  /** Contenuto del file in base64, senza prefisso `data:`. Assente per le sorgenti live. */
  data?: string
  /** MIME del blob, per ricostruirlo identico all'originale. */
  mime?: string
}

export interface ProjectFile {
  format: typeof PROJECT_FILE_FORMAT
  version: number
  exportedAt: number
  /** L'app che ha scritto il file, utile solo a chi dovrà capire un file strano fra due anni. */
  app: string
  project: Omit<StoredProject, 'layers'> & {
    layers: (Omit<StoredProject['layers'][number], 'media' | 'maskImage'> & {
      media: ExportedMedia | null
      maskImage: ExportedMedia | null
    })[]
  }
}

export interface PresetsFile {
  format: typeof PRESETS_FILE_FORMAT
  version: number
  exportedAt: number
  app: string
  presets: EffectPreset[]
}

/**
 * MIME accettati per un media importato.
 *
 * Il file arriva da fuori, e dal suo contenuto si crea un blob URL: senza questo filtro un JSON
 * ostile potrebbe farci generare un URL con un MIME arbitrario (`text/html` e simili). L'app lo
 * userebbe comunque solo come texture, ma un blob URL è un URL: si restringe all'unica cosa che
 * un media può legittimamente essere.
 */
const ALLOWED_MEDIA_MIME = /^(image|video)\//

/**
 * Byte per giro di `String.fromCharCode`: oltre, lo spread di un file grande esplode lo stack.
 *
 * **Multiplo di 3** non per caso: tre byte fanno esattamente quattro caratteri base64, quindi ogni
 * blocco tranne l'ultimo si codifica senza padding e i pezzi si concatenano. Con una taglia
 * qualunque bisognerebbe prima costruire l'intera stringa binaria e poi passarla a `btoa` in un
 * colpo solo: due copie complete del file in memoria, e nessun punto in cui cedere il controllo.
 */
const B64_CHUNK = 32766

/** Blocchi fra una resa al browser e l'altra (~1,6 MB): vedi `serializeProjectFile`. */
const YIELD_EVERY = 50

/** Lascia respirare il thread: senza, il canvas si pianta per tutta la durata dell'esportazione. */
const breathe = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

/**
 * Base64 di un blob come **elenco di pezzi**, non come stringa unica.
 *
 * I pezzi restano separati fino al `Blob` finale: concatenarli qui rifarebbe una copia intera del
 * file in memoria, che è esattamente ciò che faceva crashare la scheda sui progetti grandi.
 */
async function blobToBase64Parts(
  blob: Blob,
  /** Chiamata ogni tanto con i byte convertiti finora di *questo* blob. */
  report?: (bytesDone: number) => void,
): Promise<string[]> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const parts: string[] = []
  let sinceYield = 0
  for (let i = 0; i < bytes.length; i += B64_CHUNK) {
    const end = Math.min(i + B64_CHUNK, bytes.length)
    parts.push(btoa(String.fromCharCode(...bytes.subarray(i, end))))
    if (report && ++sinceYield >= YIELD_EVERY) {
      sinceYield = 0
      report(end)
      await breathe()
    }
  }
  report?.(bytes.length)
  return parts
}

// `Uint8Array<ArrayBuffer>` e non il generico `Uint8Array`: quello ammette anche un
// SharedArrayBuffer, che `new Blob([...])` non accetta come parte.
function base64ToBytes(data: string): Uint8Array<ArrayBuffer> {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Blob -> base64 in una stringa sola. Via `arrayBuffer()` e non `FileReader` di proposito:
 * `FileReader` esiste solo nel browser, e questa deve girare anche nel self-check da riga di
 * comando. L'esportazione **non** la usa (vedi `blobToBase64Parts`): è qui per i casi piccoli e
 * per poter verificare la conversione in isolamento.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  return (await blobToBase64Parts(blob)).join('')
}

export function base64ToBlob(data: string, mime: string): Blob {
  return new Blob([base64ToBytes(data)], { type: mime })
}

function importMedia(media: ExportedMedia | null): StoredMedia | null {
  if (!media || typeof media !== 'object') return null
  const { data, mime, ...rest } = media
  if (data === undefined) return rest
  // un media dichiarato ma illeggibile diventa un layer senza contenuto, non un import fallito:
  // perdere l'intero progetto per un asset corrotto sarebbe la reazione sbagliata
  if (typeof data !== 'string' || typeof mime !== 'string' || !ALLOWED_MEDIA_MIME.test(mime)) return null
  try {
    return { ...rest, blob: base64ToBlob(data, mime) }
  } catch {
    return null
  }
}

/** Avanzamento dell'esportazione, per la barra: `done`/`total` sono byte di asset da convertire. */
export interface ExportProgress {
  /** `assets` = conversione dei media (la parte lunga); `write` = assemblaggio del file. */
  phase: 'assets' | 'write'
  done: number
  total: number
}

/**
 * Progetto -> file scaricabile (asset inclusi).
 *
 * Restituisce un `Blob` e non una stringa, ed è il punto centrale di questa funzione: la versione
 * che concatenava tutto in una stringa unica faceva **crashare la scheda** sui progetti con dei
 * video. Teneva in memoria, insieme, il file binario, la stringa binaria, il base64, il JSON
 * completo e infine il Blob: cinque copie dello stesso contenuto.
 *
 * Qui il contenuto pesante non viene mai unito. Lo scheletro JSON si costruisce con `stringify` su
 * un oggetto in cui ogni media porta solo un **segnaposto** al posto dei dati — quindi su pochi KB
 * — poi lo si taglia sui segnaposto e si intercalano i pezzi base64 come parti separate del Blob,
 * che è il browser ad assemblare (su disco, se serve). Il base64 usa solo `A-Za-z0-9+/=`, nessuno
 * dei quali va escapato in JSON: infilarlo grezzo fra le virgolette dello scheletro produce un
 * JSON valido.
 *
 * `onProgress` serve a due cose insieme: dare la percentuale, e certificare che il thread respira.
 * La conversione cede il controllo ogni ~1,6 MB, altrimenti il canvas resta piantato per tutta la
 * durata dell'esportazione — inaccettabile in un'app che sta proiettando.
 */
export async function serializeProjectFile(
  project: StoredProject,
  onProgress?: (p: ExportProgress) => void,
): Promise<Blob> {
  const total = project.layers.reduce(
    (sum, l) => sum + (l.media?.blob?.size ?? 0) + (l.maskImage?.blob?.size ?? 0),
    0,
  )
  let doneBefore = 0
  const report = (bytesOfCurrent: number) =>
    onProgress?.({ phase: 'assets', done: doneBefore + bytesOfCurrent, total })
  onProgress?.({ phase: 'assets', done: 0, total })

  /** Pezzi base64 di ogni media, tenuti da parte e ricuciti solo dentro il Blob finale. */
  const chunksByToken = new Map<string, string[]>()

  const exportMedia = async (media: StoredMedia | null): Promise<ExportedMedia | null> => {
    if (!media) return null
    const { blob, ...rest } = media
    if (!blob) return rest // sorgente live: c'è il device, non c'è un file
    // Solo lettere, cifre e trattini: JSON.stringify non escapa nessuno di questi, quindi il
    // segnaposto si ritrova nello scheletro esattamente com'è stato scritto.
    const token = `EASYMAP_ASSET_${crypto.randomUUID()}`
    chunksByToken.set(token, await blobToBase64Parts(blob, report))
    doneBefore += blob.size
    return { ...rest, data: token, mime: blob.type }
  }

  // in sequenza e non con Promise.all: convertire più media insieme moltiplicherebbe la memoria
  // occupata proprio nel caso che si vuole evitare, quello del progetto pesante
  const layers: ProjectFile['project']['layers'] = []
  for (const layer of project.layers) {
    layers.push({
      ...layer,
      media: await exportMedia(layer.media),
      maskImage: await exportMedia(layer.maskImage),
    })
  }

  onProgress?.({ phase: 'write', done: total, total })
  // l'handle della cartella non è JSON e non varrebbe nulla su un altro computer: restano il nome
  // e l'elenco dei file, che bastano a ritrovarla e a ricollegarla con "Riconnetti"
  const assetPlaylists = Object.fromEntries(
    Object.entries(project.assetPlaylists ?? {}).map(([id, { dir: _dir, ...rest }]) => [id, rest]),
  )
  const file: ProjectFile = {
    format: PROJECT_FILE_FORMAT,
    version: PROJECT_FILE_VERSION,
    exportedAt: Date.now(),
    app: 'EasyMap Studio',
    project: { ...project, layers, assetPlaylists },
  }

  // scheletro leggero: i media qui dentro sono ancora segnaposto di poche decine di byte
  const skeleton = JSON.stringify(file)
  const parts: BlobPart[] = []
  let rest = skeleton
  for (const [token, chunks] of chunksByToken) {
    // si cerca la forma SERIALIZZATA del segnaposto, non quella grezza: se un giorno contenesse un
    // carattere che JSON escapa, cercarlo tale e quale non lo troverebbe piu' e l'asset andrebbe
    // perso in silenzio. (E' gia' successo: due NUL al posto degli spazi, resi \u0000 nel JSON.)
    const written = JSON.stringify(token).slice(1, -1)
    const at = rest.indexOf(written)
    // un segnaposto che non si ritrova significherebbe un asset perso in silenzio: meglio fallire
    if (at < 0) throw new ProjectFileError("Esportazione non riuscita: un asset non è stato scritto.")
    parts.push(rest.slice(0, at), ...chunks)
    rest = rest.slice(at + written.length)
  }
  parts.push(rest)
  return new Blob(parts, { type: 'application/json' })
}

/** Libreria dei preset -> file scaricabile. Nessun blob in gioco: qui basta uno `stringify`. */
export function serializePresetsFile(presets: EffectPreset[]): Blob {
  const file: PresetsFile = {
    format: PRESETS_FILE_FORMAT,
    version: PRESETS_FILE_VERSION,
    exportedAt: Date.now(),
    app: 'EasyMap Studio',
    presets,
  }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

/** Errore con un messaggio già scritto per l'utente: la UI lo mostra così com'è. */
export class ProjectFileError extends Error {}

/**
 * File JSON -> progetto, validando quanto basta.
 *
 * Il file arriva da fuori: prima di toccare la scena si controlla che sia davvero un progetto e
 * che le parti che verranno usate come tali (layer, media) abbiano la forma giusta. Non si valida
 * campo per campo — un parametro sballato produce un layer strano, non un danno — ma la struttura
 * portante sì, altrimenti l'errore emergerebbe più tardi, a scena già sostituita.
 */
/**
 * Apre l'involucro comune ai due tipi di file (progetto e preset) e ne verifica identità e
 * versione, prima che chiunque guardi il contenuto.
 */
function openEnvelope<T>(text: string, expected: string, whatItIsnt: string): Partial<T> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ProjectFileError('Il file non è un JSON valido.')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new ProjectFileError('Il file è vuoto o non ha la forma attesa.')
  }
  const file = parsed as { format?: unknown; version?: unknown }
  if (file.format !== expected) {
    throw new ProjectFileError(whatItIsnt)
  }
  if (typeof file.version !== 'number' || file.version > PROJECT_FILE_VERSION) {
    throw new ProjectFileError(
      `Il file è stato creato con una versione più recente dell'app (formato ${String(file.version)}).`,
    )
  }
  return parsed as Partial<T>
}

/** Che tipo di file è, senza doverlo importare: serve al pulsante unico di importazione. */
export function detectFileKind(text: string): 'project' | 'presets' | null {
  try {
    const format = (JSON.parse(text) as { format?: unknown } | null)?.format
    if (format === PROJECT_FILE_FORMAT) return 'project'
    if (format === PRESETS_FILE_FORMAT) return 'presets'
  } catch {
    /* non è JSON: lo dirà il parser vero, con il suo messaggio */
  }
  return null
}

/**
 * File JSON -> libreria di preset.
 *
 * I preset non hanno blob: la validazione si limita a scartare le voci senza la struttura minima
 * (un nome e uno shader), invece di rifiutare l'intero file per una riga rovinata.
 */
export function parsePresetsFile(text: string): EffectPreset[] {
  const file = openEnvelope<PresetsFile>(text, PRESETS_FILE_FORMAT, 'Questo file non è una libreria di preset di EasyMap Studio.')
  if (!Array.isArray(file.presets)) {
    throw new ProjectFileError('Il file non contiene nessun preset.')
  }
  const valid = file.presets.filter(
    (p): p is EffectPreset =>
      !!p && typeof p === 'object' && typeof p.name === 'string' && typeof p.shaderName === 'string',
  )
  if (valid.length === 0) {
    throw new ProjectFileError('Il file non contiene nessun preset valido.')
  }
  // id nuovi: un preset importato non deve poter sovrascrivere quello con lo stesso id in libreria
  return valid.map((p) => ({ ...p, id: crypto.randomUUID(), updatedAt: Date.now() }))
}

export function parseProjectFile(text: string): StoredProject {
  const file = openEnvelope<ProjectFile>(text, PROJECT_FILE_FORMAT, 'Questo file non è un progetto di EasyMap Studio.')
  const project = file.project
  if (!project || typeof project !== 'object' || !Array.isArray(project.layers)) {
    throw new ProjectFileError('Il progetto nel file è incompleto: manca l\'elenco dei layer.')
  }
  if (project.layers.length === 0) {
    throw new ProjectFileError('Il progetto nel file non ha nessun layer.')
  }
  if (project.layers.some((l) => !l || typeof l !== 'object' || typeof l.id !== 'string')) {
    throw new ProjectFileError('Il progetto nel file ha layer non validi.')
  }

  return {
    ...project,
    // id nuovo: importare due volte lo stesso file deve dare due progetti in lista, non
    // sovrascrivere silenziosamente il primo
    id: crypto.randomUUID(),
    name: typeof project.name === 'string' && project.name.trim() ? project.name : 'Progetto importato',
    updatedAt: Date.now(),
    layers: project.layers.map((layer) => ({
      ...layer,
      media: importMedia(layer.media),
      maskImage: importMedia(layer.maskImage),
    })),
    activeLayerId:
      typeof project.activeLayerId === 'string' &&
      project.layers.some((l) => l.id === project.activeLayerId)
        ? project.activeLayerId
        : project.layers[0].id,
  }
}

/**
 * I quattro angoli del corner-pin hanno la forma attesa?
 *
 * Serve perche' un `corners` malformato fa esplodere `quadAspect` a ogni frame. Sta qui, in un
 * modulo puro, per poter essere verificata dal self-check: la prima stesura controllava
 * `Array.isArray(c)` dando per scontato che un angolo fosse `[x, y]` mentre e' `{x, y}`, quindi
 * dichiarava invalidi i corner di TUTTI i progetti e li riportava al rettangolo di default —
 * ogni layer schiacciato nella stessa forma. Un controllo di validita' sbagliato fa piu' danni
 * del dato che vuole proteggere, e questo e' il tipo di errore che solo un test coglie.
 */
export function isValidCorners(corners: unknown): corners is Corners {
  return (
    Array.isArray(corners) &&
    corners.length === 4 &&
    corners.every(
      (c) =>
        !!c &&
        typeof c === 'object' &&
        Number.isFinite((c as Corner).x) &&
        Number.isFinite((c as Corner).y),
    )
  )
}

/** Nome del file scaricato: il nome del progetto, ripulito da ciò che un filesystem non gradisce. */
export function projectFileName(name: string, suffix = 'easymap'): string {
  const safe = name.trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').slice(0, 80)
  return `${safe || 'progetto'}.${suffix}.json`
}
