import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useEffect } from 'react'
import { useLayersStore, createLayer, type Layer } from '../store/layersStore'
import { usePlaylistStore, playlistSnapshot, type PlaylistData } from '../store/playlistStore'
import { loadDefaultStageIfFirstVisit } from './defaultAsset'
import { DEFAULT_SIZE } from '../store/effectsStore'
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
interface StoredMedia {
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
  /** Playlist di effetti del progetto (assente nei progetti salvati prima della feature). */
  playlist?: PlaylistData
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

/** Ricostruisce un layer da IndexedDB, rigenerando i blob URL. */
function deserializeLayer(stored: StoredLayer): Layer {
  const { media, maskImage, ...rest } = stored
  const base = createLayer(rest)
  return {
    ...base,
    ...rest,
    media: deserializeMedia(media),
    maskImage: deserializeMedia(maskImage),
  }
}

/** Fotografa la scena corrente in un oggetto persistibile. */
function snapshot(id: string, name: string): StoredProject {
  const { layers, activeLayerId } = useLayersStore.getState()
  return {
    id,
    name,
    updatedAt: Date.now(),
    layers: layers.map(serializeLayer),
    activeLayerId,
    playlist: playlistSnapshot(),
  }
}

/** Applica un progetto salvato allo store (ricreando i blob URL dei media). */
function applyProject(project: StoredProject) {
  const layers = project.layers.map(deserializeLayer)
  useLayersStore.getState().setScene(layers, project.activeLayerId)
  // progetti pre-playlist: undefined → playlist vuota coi default
  usePlaylistStore.getState().setPlaylistData(project.playlist)
}

/** La scena è "vuota" se ha un solo layer senza contenuto: allora l'autosave può ripristinare. */
function isSceneEmpty(): boolean {
  const { layers } = useLayersStore.getState()
  return layers.length === 1 && layers[0].media == null
}

export async function saveProject(name: string): Promise<string> {
  const id = crypto.randomUUID()
  const db = await getDb()
  await db.put('projects', snapshot(id, name))
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
function applyEffectPreset(preset: EffectPreset) {
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
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
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
      await db.put('projects', snapshot(AUTOSAVE_ID, 'Autosave'))
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
    let lastPlaylistJson = JSON.stringify(playlistSnapshot())
    const unsubPlaylist = usePlaylistStore.subscribe(() => {
      const json = JSON.stringify(playlistSnapshot())
      if (json === lastPlaylistJson) return
      lastPlaylistJson = json
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
    }
  }, [])
}
