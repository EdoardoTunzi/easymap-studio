import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useEffect } from 'react'
import { useLayersStore, createLayer, type Layer } from '../store/layersStore'
import { usePlaylistStore, playlistSnapshot, type PlaylistData } from '../store/playlistStore'
import { loadDefaultStageIfFirstVisit } from './defaultAsset'
import { DEFAULT_SIZE, useEffectsStore } from '../store/effectsStore'
import { type Palette, type RGB } from '../store/paletteStore'
import type { MediaAsset, MediaType } from '../store/projectStore'
import { parseShader } from '../engine/isfParser'
import type { ModuleInstance } from '../engine/generativeModules'
import type { GenerativeMode } from '../store/generativeStore'

const AUTOSAVE_ID = '__autosave__'
const AUTOSAVE_DEBOUNCE_MS = 600

/** Media come salvato: il blob (persistente) al posto del blob URL (transiente). */
interface StoredMedia {
  name: string
  type: MediaType
  width: number
  height: number
  blob: Blob
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

/** Un visual generativo creato dall'utente nel Generative Lab. */
export interface GenerativeVisual {
  id: string
  /** Coincide col nome dello shader (`// NAME:` nella sorgente): è la chiave in effectsStore. */
  name: string
  updatedAt: number
  mode: GenerativeMode
  stack: ModuleInstance[]
  /** Sorgente GLSL completa, pronta per `parseShader()`. */
  source: string
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
  generativeVisuals: {
    key: string
    value: GenerativeVisual
  }
}

let dbPromise: Promise<IDBPDatabase<EasyVjDB>> | null = null

function getDb() {
  dbPromise ??= openDB<EasyVjDB>('easyvj', 4, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore('projects', { keyPath: 'id' })
      if (oldVersion < 2) db.createObjectStore('effectPresets', { keyPath: 'id' })
      // v3: i progetti passano da stato piatto a array di layer. Gli oggetti vecchi
      // sono incompatibili col nuovo formato: si svuota lo store dei progetti.
      if (oldVersion > 0 && oldVersion < 3) db.clear('projects')
      if (oldVersion < 4) db.createObjectStore('generativeVisuals', { keyPath: 'id' })
    },
  })
  return dbPromise
}

function serializeMedia(media: MediaAsset | null): StoredMedia | null {
  return media?.blob != null
    ? { name: media.name, type: media.type, width: media.width, height: media.height, blob: media.blob }
    : null
}

function deserializeMedia(stored: StoredMedia | null): MediaAsset | null {
  return stored
    ? {
        id: crypto.randomUUID(),
        name: stored.name,
        type: stored.type ?? 'image',
        url: URL.createObjectURL(stored.blob),
        width: stored.width,
        height: stored.height,
        blob: stored.blob,
      }
    : null
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

// ---- Visual generativi (Generative Lab) ----

/** Registra in `effectsStore` gli shader di una lista di visual, così sono selezionabili come effetti. */
function registerVisuals(visuals: GenerativeVisual[]) {
  const shaders = visuals.map((v) => parseShader(v.source))
  useEffectsStore.getState().registerShaders(shaders)
}

/**
 * Nome libero per un visual: il nome è anche l'identità dello shader nella libreria, quindi due
 * visual diversi non possono chiamarsi uguale. Aggiunge un suffisso numerico se serve.
 */
export function uniqueVisualName(desired: string, ownId: string | null, existing: GenerativeVisual[]) {
  const base = desired.trim() || 'Visual generativo'
  const ownName = existing.find((v) => v.id === ownId)?.name
  // occupati: gli altri visual e tutti gli shader già in libreria, tranne il proprio nome attuale
  const taken = new Set<string>()
  for (const v of existing) if (v.id !== ownId) taken.add(v.name.toLowerCase())
  for (const s of useEffectsStore.getState().shaders) {
    if (s.name !== ownName) taken.add(s.name.toLowerCase())
  }
  if (!taken.has(base.toLowerCase())) return base
  let n = 2
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1
  return `${base} ${n}`
}

/**
 * Salva (o aggiorna) un visual generativo e lo registra subito come shader disponibile.
 * Restituisce il record salvato: il `name` può differire da quello richiesto se era già preso.
 */
export async function saveGenerativeVisual(visual: {
  id: string | null
  name: string
  mode: GenerativeMode
  stack: ModuleInstance[]
  source: string
}): Promise<GenerativeVisual> {
  const db = await getDb()
  const existing = await db.getAll('generativeVisuals')
  const previous = visual.id ? existing.find((v) => v.id === visual.id) : undefined
  const name = uniqueVisualName(visual.name, visual.id, existing)
  // il nome è dentro la sorgente (`// NAME:`): va riallineato se è stato deduplicato
  const source = visual.source.replace(/\/\/\s*NAME:\s*.+/, `// NAME: ${name}`)

  const record: GenerativeVisual = {
    id: visual.id ?? crypto.randomUUID(),
    name,
    updatedAt: Date.now(),
    mode: visual.mode,
    stack: visual.stack,
    source,
  }
  await db.put('generativeVisuals', record)

  // rinominando, lo shader vecchio non esiste più nella libreria
  if (previous && previous.name !== name) useEffectsStore.getState().unregisterShader(previous.name)
  registerVisuals([record])
  return record
}

export async function listGenerativeVisuals(): Promise<GenerativeVisual[]> {
  const db = await getDb()
  const all = await db.getAll('generativeVisuals')
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function deleteGenerativeVisual(id: string): Promise<void> {
  const db = await getDb()
  const visual = await db.get('generativeVisuals', id)
  await db.delete('generativeVisuals', id)
  if (visual) useEffectsStore.getState().unregisterShader(visual.name)
}

/**
 * Da montare in Control e Output: carica i visual generativi salvati e li registra nella libreria
 * shader, così i layer che li usano trovano il loro effetto anche dopo un reload.
 */
export function useLoadGenerativeVisuals() {
  useEffect(() => {
    let cancelled = false
    listGenerativeVisuals().then((visuals) => {
      if (!cancelled) registerVisuals(visuals)
    })
    return () => {
      cancelled = true
    }
  }, [])
}

/**
 * Da montare nella finestra di Controllo: al mount ripristina l'autosave (se la scena è
 * ancora vuota), poi salva automaticamente ogni modifica con debounce.
 */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    let restoring = true

    const persist = () => {
      if (restoring) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const db = await getDb()
        await db.put('projects', snapshot(AUTOSAVE_ID, 'Autosave'))
      }, AUTOSAVE_DEBOUNCE_MS)
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
