import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useEffect } from 'react'
import { useLayersStore, createLayer, type Layer } from '../store/layersStore'
import {
  usePlaylistStore,
  playlistsSnapshot,
  migrateLegacyPlaylist,
  type PlaylistData,
  type PlaylistsData,
} from '../store/playlistStore'
import {
  useAssetPlaylistStore,
  assetPlaylistsSnapshot,
  type AssetPlaylists,
} from '../store/assetPlaylistStore'
import { loadDefaultStageIfFirstVisit } from './defaultAsset'
import {
  detectFileKind,
  isValidCorners,
  parsePresetsFile,
  parseProjectFile,
  serializePresetsFile,
  serializeProjectFile,
  type ExportProgress,
} from './projectFile'
import { DEFAULT_SIZE, useEffectsStore } from '../store/effectsStore'
import { migrateLayerShaderNames, migrateShaderName } from './shaderNameMigration'
import { type Palette, type RGB } from '../store/paletteStore'
import type { MediaAsset, MediaType } from '../store/projectStore'

const AUTOSAVE_ID = '__autosave__'
const AUTOSAVE_DEBOUNCE_MS = 600
/**
 * Intervallo minimo fra due autosave. Lo snapshot include i blob dei media (l'asset dimostrativo
 * da solo pesa 7 MB) e una scrittura misura ~50 ms di main thread: con un'animazione continua
 * (loop delle palette, playlist in riproduzione) partiva a ogni pausa e si vedeva come scatto
 * sul canvas. Il tetto la rende periodica invece che reattiva a ogni raffica di modifiche.
 */
const AUTOSAVE_MIN_INTERVAL_MS = 5000

/** Media come salvato: il blob (persistente) al posto del blob URL (transiente). */
export interface StoredMedia {
  name: string
  type: MediaType
  width: number
  height: number
  /** Assente per le sorgenti live: non c'è nessun file da salvare. */
  blob?: Blob
  /** Solo `camera`: device da riaprire al ripristino del progetto. */
  deviceId?: string
}

/** Un layer serializzato: media e maschera-immagine ridotti al solo blob; niente stato transiente. */
type StoredLayer = Omit<Layer, 'media' | 'maskImage' | 'transition'> & {
  media: StoredMedia | null
  maskImage: StoredMedia | null
}

export interface StoredProject {
  id: string
  name: string
  updatedAt: number
  layers: StoredLayer[]
  activeLayerId: string
  /**
   * Playlist di effetti, una per layer. Assente nei progetti salvati prima del per-layer: lì c'è
   * `playlist`, e al caricamento viene convertita (vedi `migrateLegacyPlaylist`).
   */
  playlists?: PlaylistsData
  /** Forma legacy: una playlist sola per tutto il progetto. Si legge, non si scrive più. */
  playlist?: PlaylistData
  /**
   * Playlist di asset, per layer. Contiene l'handle della cartella (structured-clonable, quindi
   * IndexedDB lo salva com'è) ma **non** i file: alla riapertura il permesso va riconcesso e le
   * clip si rileggono dal disco. È il motivo per cui il progetto resta di pochi KB anche con
   * cartelle di video.
   */
  assetPlaylists?: AssetPlaylists
}

/** Preset di un effetto: cattura il "look" (shader + parametri + size + palette), riusabile su qualsiasi layer. */
export interface EffectPreset {
  id: string
  name: string
  updatedAt: number
  shaderName: string
  /** Parametri del solo shader del preset. */
  params: Record<string, number>
  /** Colori (uniform vec3) dello shader; assente nei preset salvati prima della feature. */
  colors?: Record<string, RGB>
  size: number
  palette: Palette
}

interface EasyVjDB extends DBSchema {
  projects: {
    key: string
    value: StoredProject
  }
  effectPresets: {
    key: string
    value: EffectPreset
  }
}

let dbPromise: Promise<IDBPDatabase<EasyVjDB>> | null = null

function getDb() {
  dbPromise ??= openDB<EasyVjDB>('easyvj', 6, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore('projects', { keyPath: 'id' })
      if (oldVersion < 2) db.createObjectStore('effectPresets', { keyPath: 'id' })
      // v3: i progetti passano da stato piatto a array di layer. Gli oggetti vecchi
      // sono incompatibili col nuovo formato: si svuota lo store dei progetti.
      if (oldVersion > 0 && oldVersion < 3) db.clear('projects')
      // v5 aveva uno store `mappingPresets`, poi tolto. Non si può tornare alla 4 (IndexedDB non
      // scende di versione), quindi si sale alla 6 e si elimina lo store orfano dove esiste.
      if (db.objectStoreNames.contains('mappingPresets' as never)) {
        db.deleteObjectStore('mappingPresets' as never)
      }
    },
  })
  return dbPromise
}

function serializeMedia(media: MediaAsset | null): StoredMedia | null {
  if (!media) return null
  // sorgente live: si salva il riferimento al device, il flusso video ovviamente no
  if (media.type === 'camera') {
    return {
      name: media.name,
      type: media.type,
      width: media.width,
      height: media.height,
      deviceId: media.deviceId,
    }
  }
  return media.blob != null
    ? { name: media.name, type: media.type, width: media.width, height: media.height, blob: media.blob }
    : null
}

function deserializeMedia(stored: StoredMedia | null): MediaAsset | null {
  if (!stored) return null
  const base = {
    id: crypto.randomUUID(),
    name: stored.name,
    type: stored.type ?? 'image',
    width: stored.width,
    height: stored.height,
  }
  // la camera riparte da sola: il controller riapre il device al montaggio del layer (se non è
  // più collegato la texture resta vuota, senza rompere il resto della scena)
  if (stored.type === 'camera') return { ...base, url: '', deviceId: stored.deviceId }
  if (!stored.blob) return null
  return { ...base, url: URL.createObjectURL(stored.blob), blob: stored.blob }
}

/** Serializza un layer per la persistenza (media/maschera → solo blob, url rigenerato al load). */
function serializeLayer(layer: Layer): StoredLayer {
  const { media, maskImage, transition: _transition, ...rest } = layer
  return { ...rest, media: serializeMedia(media), maskImage: serializeMedia(maskImage) }
}

/**
 * Ricostruisce un layer, rigenerando i blob URL.
 *
 * I campi salvati vincono sui default di `createLayer`, ma solo se hanno la forma giusta: un
 * `corners` non valido fa esplodere `quadAspect` a **ogni frame**, cioè trasforma un singolo campo
 * rovinato in una scena che non si disegna piu'. Il controllo sta qui e non nel parser dei file
 * perche' questa e' la porta d'ingresso comune a tutti i progetti — autosave, salvati e importati —
 * e un progetto puo' essere rovinato anche senza passare da un file.
 */
function deserializeLayer(stored: StoredLayer): Layer {
  const { media, maskImage, corners, ...rest } = stored
  const base = createLayer(rest)
  return {
    ...base,
    ...rest,
    corners: isValidCorners(corners) ? corners : base.corners,
    media: deserializeMedia(media),
    maskImage: deserializeMedia(maskImage),
  }
}

/** Fotografa la scena corrente in un oggetto persistibile. */
function snapshot(id: string, name: string): StoredProject {
  const { layers, activeLayerId } = useLayersStore.getState()
  // le playlist sono indicizzate per layer: quelle dei layer eliminati resterebbero nello snapshot
  // per sempre, crescendo a ogni salvataggio. Si potano qui, l'unico punto in cui si scrive.
  const alive = new Set(layers.map((l) => l.id))
  const onlyAlive = <T,>(byLayer: Record<string, T>) =>
    Object.fromEntries(Object.entries(byLayer).filter(([layerId]) => alive.has(layerId)))
  const playlists = playlistsSnapshot()
  return {
    id,
    name,
    updatedAt: Date.now(),
    layers: layers.map(serializeLayer),
    activeLayerId,
    playlists: { ...playlists, byLayer: onlyAlive(playlists.byLayer) },
    assetPlaylists: onlyAlive(assetPlaylistsSnapshot()),
  }
}

/**
 * Scrive il progetto, riprovando senza gli handle delle cartelle se la prima scrittura fallisce.
 *
 * Gli handle sono structured-clonable e IndexedDB li accetta, ma è l'unico pezzo dello snapshot
 * che non controlliamo noi: se un browser si rifiutasse di serializzarli, l'eccezione farebbe
 * fallire il salvataggio **dell'intero progetto**, cioè si perderebbe tutto per un riferimento a
 * una cartella. Meglio salvare il resto e chiedere di ricollegarla.
 */
async function putProject(db: IDBPDatabase<EasyVjDB>, project: StoredProject): Promise<void> {
  try {
    await db.put('projects', project)
  } catch {
    await db.put('projects', {
      ...project,
      assetPlaylists: Object.fromEntries(
        Object.entries(project.assetPlaylists ?? {}).map(([id, d]) => [id, { ...d, dir: undefined }]),
      ),
    })
  }
}

/** Applica un progetto salvato allo store (ricreando i blob URL dei media). */
/**
 * Predicato "questo shader esiste ancora", per il recupero dei nomi rinominati.
 *
 * Letto al momento dell'uso e non memorizzato: la libreria si popola all'avvio, e una copia presa
 * troppo presto direbbe che non esiste nulla — cioè non recupererebbe niente proprio al ripristino
 * dell'autosave, il caso piu' frequente.
 */
const shaderExists = (name: string) =>
  useEffectsStore.getState().shaders.some((s) => s.name === name)

/**
 * Riporta ai nomi attuali i riferimenti agli shader rinominati (vedi `shaderNameMigration.ts`).
 *
 * Si fa al **caricamento** e non con una migrazione dello store IndexedDB perche' cosi' vale anche
 * per i progetti che arrivano da un file esportato, e perche' non c'e' un momento sicuro in cui
 * riscrivere in blocco progetti che l'utente non ha ancora aperto.
 */
function migrateProjectShaderNames(project: StoredProject): StoredProject {
  const playlists = project.playlists && {
    ...project.playlists,
    byLayer: Object.fromEntries(
      Object.entries(project.playlists.byLayer).map(([layerId, playlist]) => [
        layerId,
        {
          ...playlist,
          clips: playlist.clips.map((clip) => ({
            ...clip,
            shaderName: migrateShaderName(clip.shaderName, shaderExists),
          })),
        },
      ]),
    ),
  }
  return {
    ...project,
    layers: project.layers.map((l) => migrateLayerShaderNames(l, shaderExists)),
    ...(playlists ? { playlists } : {}),
  }
}

function applyProject(stored: StoredProject) {
  const project = migrateProjectShaderNames(stored)
  const layers = project.layers.map(deserializeLayer)
  useLayersStore.getState().setScene(layers, project.activeLayerId)
  // progetti pre-playlist: undefined → nessuna playlist. Quelli con la playlist unica salvata
  // prima del per-layer se la ritrovano sul layer che era attivo, cioè l'unico su cui girava.
  usePlaylistStore
    .getState()
    .setPlaylistsData(
      project.playlists ??
        (project.playlist ? migrateLegacyPlaylist(project.playlist, project.activeLayerId) : undefined),
    )
  useAssetPlaylistStore.getState().setAssetPlaylists(project.assetPlaylists)
}

/** La scena è "vuota" se ha un solo layer senza contenuto: allora l'autosave può ripristinare. */
function isSceneEmpty(): boolean {
  const { layers } = useLayersStore.getState()
  return layers.length === 1 && layers[0].media == null
}

/** Azzera la scena a un progetto vuoto con un solo layer, senza toccare i progetti salvati su disco. */
export function newProject(): void {
  const layer = createLayer({ name: 'Layer 1' })
  useLayersStore.getState().setScene([layer], layer.id)
  usePlaylistStore.getState().setPlaylistsData(undefined)
  useAssetPlaylistStore.getState().setAssetPlaylists(undefined)
}

export async function saveProject(name: string): Promise<string> {
  const id = crypto.randomUUID()
  const db = await getDb()
  await putProject(db, snapshot(id, name))
  return id
}

export async function loadProject(id: string): Promise<boolean> {
  const db = await getDb()
  const project = await db.get('projects', id)
  if (!project) return false
  applyProject(project)
  return true
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('projects', id)
}

// ---- Esportazione e importazione come file JSON ----

/**
 * Il progetto salvato `id`, come file pronto da scaricare (asset inclusi).
 *
 * Non ha una controparte "scarica": il salvataggio su disco è DOM, e tenerlo fuori da qui lascia
 * questo modulo indipendente dal browser (vedi `projectFile.ts`).
 */
export async function exportProjectToFile(
  id: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<Blob | null> {
  const db = await getDb()
  const project = await db.get('projects', id)
  return project ? serializeProjectFile(project, onProgress) : null
}

/** La scena corrente come file, senza doverla prima salvare fra i progetti. */
export function exportCurrentSceneToFile(
  name: string,
  onProgress?: (p: ExportProgress) => void,
): Promise<Blob> {
  return serializeProjectFile(snapshot(crypto.randomUUID(), name), onProgress)
}

/** Un solo preset come file, per condividerne uno senza spedire tutta la libreria. */
export async function exportPresetToFile(id: string): Promise<{ blob: Blob; name: string } | null> {
  const db = await getDb()
  const preset = await db.get('effectPresets', id)
  if (!preset) return null
  // migrato come in `listEffectPresets`: il file deve portare il nome shader attuale, altrimenti
  // esporterebbe un riferimento gia' rotto in partenza
  const migrated = { ...preset, shaderName: migrateShaderName(preset.shaderName, shaderExists) }
  return { blob: serializePresetsFile([migrated]), name: preset.name }
}

/** L'intera libreria dei preset come file. Sono pochi KB: nessun avanzamento da mostrare. */
export async function exportPresetsToFile(): Promise<{ blob: Blob; count: number } | null> {
  const presets = await listEffectPresets()
  return presets.length > 0 ? { blob: serializePresetsFile(presets), count: presets.length } : null
}

/** Esito di un'importazione, discriminato dal tipo di file che è arrivato. */
export type ImportResult =
  | { kind: 'project'; id: string; name: string }
  | { kind: 'presets'; imported: number; skipped: number }

/**
 * Importa un file esportato, progetto o libreria di preset che sia.
 *
 * Un solo ingresso perché il tipo si legge dal file: chiedere all'utente di indovinare quale
 * pulsante usare sarebbe un passaggio in più per un'informazione che abbiamo già.
 *
 * In entrambi i casi si **aggiunge**, senza sostituire nulla di ciò che c'è: un progetto va fra
 * quelli salvati e non apre la scena (aprire d'ufficio farebbe perdere il lavoro non salvato a chi
 * voleva solo mettere via un file); i preset si uniscono alla libreria saltando quelli già
 * presenti — stesso nome e stesso shader — così reimportare lo stesso file non riempie l'elenco di
 * doppioni.
 *
 * Rilancia `ProjectFileError` con un messaggio già leggibile se il file non è valido.
 */
export async function importFromJson(text: string): Promise<ImportResult> {
  const db = await getDb()
  if (detectFileKind(text) === 'presets') {
    const incoming = parsePresetsFile(text)
    const existing = await db.getAll('effectPresets')
    // \u0000 come separatore e non uno spazio: non puo' comparire in un nome, quindi due preset
    // diversi non possono collidere sulla stessa chiave ("a b"+"c" contro "a"+"b c").
    const key = (p: EffectPreset) => `${p.name}\u0000${p.shaderName}`
    const known = new Set(existing.map(key))
    let imported = 0
    for (const preset of incoming) {
      if (known.has(key(preset))) continue
      await db.put('effectPresets', preset)
      imported++
    }
    return { kind: 'presets', imported, skipped: incoming.length - imported }
  }
  const project = parseProjectFile(text)
  await putProject(db, project)
  return { kind: 'project', id: project.id, name: project.name }
}

export async function listProjects(): Promise<Omit<StoredProject, 'layers'>[]> {
  const db = await getDb()
  const all = await db.getAll('projects')
  return all
    .filter((p) => p.id !== AUTOSAVE_ID)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ layers: _layers, ...rest }) => rest)
}

// ---- Preset degli effetti (shader + parametri + size + palette del layer attivo) ----

function clonePalette(p: Palette): Palette {
  return { ...p, colors: p.colors.map((c) => [...c] as RGB) }
}

/** Cattura il look del layer attivo come preset di effetto. */
function effectPresetSnapshot(id: string, name: string): EffectPreset {
  const layer = useLayersStore.getState().getActiveLayer()
  return {
    id,
    name,
    updatedAt: Date.now(),
    shaderName: layer?.shaderName ?? '',
    params: { ...(layer?.params[layer.shaderName] ?? {}) },
    colors: { ...(layer?.colorParams[layer.shaderName] ?? {}) },
    size: layer?.size ?? DEFAULT_SIZE,
    palette: layer ? clonePalette(layer.palette) : ({} as Palette),
  }
}

/** Applica un preset di effetto al layer attivo (senza toccare media/posizionamento). */
function applyEffectPreset(raw: EffectPreset) {
  // stesso recupero dei progetti: un preset salvato prima del rename punta a uno shader che
  // non esiste piu', e applicarlo lascerebbe il layer vuoto invece di cambiargli effetto
  const preset = { ...raw, shaderName: migrateShaderName(raw.shaderName, shaderExists) }
  useLayersStore.setState((state) => ({
    layers: state.layers.map((l) =>
      l.id === state.activeLayerId
        ? {
            ...l,
            shaderName: preset.shaderName,
            size: preset.size ?? DEFAULT_SIZE,
            params: { ...l.params, [preset.shaderName]: { ...preset.params } },
            colorParams: { ...l.colorParams, [preset.shaderName]: { ...(preset.colors ?? {}) } },
            palette: preset.palette ? clonePalette(preset.palette) : l.palette,
          }
        : l,
    ),
  }))
}

export async function saveEffectPreset(name: string): Promise<string> {
  const id = crypto.randomUUID()
  const db = await getDb()
  await db.put('effectPresets', effectPresetSnapshot(id, name))
  return id
}

export async function loadEffectPreset(id: string): Promise<boolean> {
  const db = await getDb()
  const preset = await db.get('effectPresets', id)
  if (!preset) return false
  applyEffectPreset(preset)
  return true
}

export async function deleteEffectPreset(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('effectPresets', id)
}

export async function listEffectPresets(): Promise<EffectPreset[]> {
  const db = await getDb()
  const all = await db.getAll('effectPresets')
  // il nome corretto va restituito anche a chi legge l'elenco: il pannello lo mostra accanto al
  // preset, e la playlist ci costruisce i clip
  return all
    .map((p) => ({ ...p, shaderName: migrateShaderName(p.shaderName, shaderExists) }))
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Da montare nella finestra di Controllo: al mount ripristina l'autosave (se la scena è
 * ancora vuota), poi salva automaticamente ogni modifica con debounce.
 */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let restoring = true

    let lastWrite = 0

    const flush = async () => {
      timer = null
      const db = await getDb()
      await putProject(db, snapshot(AUTOSAVE_ID, 'Autosave'))
      lastWrite = performance.now()
    }

    /**
     * Pianifica il salvataggio. A differenza di un debounce puro, un salvataggio già pianificato
     * NON viene rimandato dalle modifiche successive: durante una raffica continua (un fade di
     * palette scrive decine di volte al secondo) il debounce si sarebbe riarmato all'infinito,
     * per poi scattare tutto insieme a ogni pausa. Così la scena finisce su disco entro
     * `AUTOSAVE_DEBOUNCE_MS` da quando è cambiata, ma mai più spesso del tetto minimo.
     */
    const persist = () => {
      if (restoring || timer) return
      const sinceLast = performance.now() - lastWrite
      const wait = Math.max(AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MIN_INTERVAL_MS - sinceLast)
      timer = setTimeout(flush, wait)
    }

    const unsub = useLayersStore.subscribe(persist)

    // la playlist cambia anche a ogni frame di riproduzione (playing/progress): salva solo
    // quando cambia il sottoinsieme persistibile (clip, transizione, loop)
    let lastPlaylistJson = JSON.stringify(playlistsSnapshot())
    const unsubPlaylist = usePlaylistStore.subscribe(() => {
      const json = JSON.stringify(playlistsSnapshot())
      if (json === lastPlaylistJson) return
      lastPlaylistJson = json
      persist()
    })

    // stessa guardia per le playlist di asset: l'indice della clip avanza a ogni cambio e
    // risveglierebbe il salvataggio senza che sia cambiato nulla di persistibile
    let lastAssetJson = JSON.stringify(assetPlaylistsSnapshot())
    const unsubAssets = useAssetPlaylistStore.subscribe(() => {
      const json = JSON.stringify(assetPlaylistsSnapshot())
      if (json === lastAssetJson) return
      lastAssetJson = json
      persist()
    })

    ;(async () => {
      try {
        if (!isSceneEmpty()) return
        const db = await getDb()
        const autosave = await db.get('projects', AUTOSAVE_ID)
        // ricontrolla dopo l'await: se nel frattempo l'utente ha caricato
        // qualcosa, il restore non deve sovrascriverlo
        if (autosave && isSceneEmpty()) {
          applyProject(autosave)
        } else if (isSceneEmpty()) {
          // nessun autosave: se è la primissima apertura (mai vista prima in questo
          // browser), carica l'asset dimostrativo così c'è subito qualcosa da testare
          await loadDefaultStageIfFirstVisit()
        }
      } finally {
        restoring = false
      }
    })()

    return () => {
      if (timer) clearTimeout(timer)
      unsub()
      unsubPlaylist()
      unsubAssets()
    }
  }, [])
}
