import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { useEffect } from 'react'
import {
  useProjectStore,
  DEFAULT_TRANSFORM,
  type Corners,
  type Transform,
} from '../store/projectStore'
import { useEffectsStore, DEFAULT_SIZE } from '../store/effectsStore'
import { usePaletteStore, type RGB } from '../store/paletteStore'

const AUTOSAVE_ID = '__autosave__'
const AUTOSAVE_DEBOUNCE_MS = 600

export interface StoredProject {
  id: string
  name: string
  updatedAt: number
  media: {
    name: string
    width: number
    height: number
    blob: Blob
  } | null
  corners: Corners
  transform: Transform
  lumaKey: number
  activeShaderName: string
  size: number
  params: Record<string, Record<string, number>>
  palette?: {
    enabled: boolean
    colors: RGB[]
    count: number
    amount: number
    activePreset: string
  }
}

interface PaletteSnapshot {
  enabled: boolean
  colors: RGB[]
  count: number
  amount: number
  activePreset: string
}

/** Preset di un effetto: cattura il "look" (shader + parametri + size + palette), riusabile su qualsiasi asset. */
export interface EffectPreset {
  id: string
  name: string
  updatedAt: number
  shaderName: string
  /** Parametri del solo shader del preset. */
  params: Record<string, number>
  size: number
  palette: PaletteSnapshot
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
  dbPromise ??= openDB<EasyVjDB>('easyvj', 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore('projects', { keyPath: 'id' })
      if (oldVersion < 2) db.createObjectStore('effectPresets', { keyPath: 'id' })
    },
  })
  return dbPromise
}

function currentPaletteSnapshot(): PaletteSnapshot {
  const { enabled, colors, count, amount, activePreset } = usePaletteStore.getState()
  return { enabled, colors, count, amount, activePreset }
}

/** Fotografa lo stato corrente degli store in un oggetto persistibile. */
function snapshot(id: string, name: string): StoredProject {
  const { media, corners, transform, lumaKey } = useProjectStore.getState()
  const { activeShaderName, size, params } = useEffectsStore.getState()
  const { enabled, colors, count, amount, activePreset } = usePaletteStore.getState()
  return {
    id,
    name,
    updatedAt: Date.now(),
    media:
      media?.blob != null
        ? { name: media.name, width: media.width, height: media.height, blob: media.blob }
        : null,
    corners,
    transform,
    lumaKey,
    activeShaderName,
    size,
    params,
    palette: { enabled, colors, count, amount, activePreset },
  }
}

/** Applica un progetto salvato agli store (ricreando il blob URL del media). */
function applyProject(project: StoredProject) {
  useProjectStore.setState({
    media: project.media
      ? {
          id: crypto.randomUUID(),
          name: project.media.name,
          url: URL.createObjectURL(project.media.blob),
          width: project.media.width,
          height: project.media.height,
          blob: project.media.blob,
        }
      : null,
    corners: project.corners,
    // progetti salvati prima dell'introduzione del transform non hanno il campo
    transform: project.transform ?? DEFAULT_TRANSFORM,
    lumaKey: project.lumaKey ?? 0,
  })
  useEffectsStore.setState({
    activeShaderName: project.activeShaderName,
    size: project.size ?? DEFAULT_SIZE,
    params: project.params,
  })
  if (project.palette) usePaletteStore.setState(project.palette)
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

export async function listProjects(): Promise<Omit<StoredProject, 'media'>[]> {
  const db = await getDb()
  const all = await db.getAll('projects')
  return all
    .filter((p) => p.id !== AUTOSAVE_ID)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ media: _media, ...rest }) => rest)
}

// ---- Preset degli effetti (shader + parametri + size + palette) ----

/** Cattura il look corrente come preset di effetto. */
function effectPresetSnapshot(id: string, name: string): EffectPreset {
  const { activeShaderName, size, params } = useEffectsStore.getState()
  return {
    id,
    name,
    updatedAt: Date.now(),
    shaderName: activeShaderName,
    params: { ...(params[activeShaderName] ?? {}) },
    size,
    palette: currentPaletteSnapshot(),
  }
}

/** Applica un preset di effetto agli store (senza toccare media/posizionamento). */
function applyEffectPreset(preset: EffectPreset) {
  const { params } = useEffectsStore.getState()
  useEffectsStore.setState({
    activeShaderName: preset.shaderName,
    size: preset.size ?? DEFAULT_SIZE,
    params: { ...params, [preset.shaderName]: preset.params },
  })
  if (preset.palette) usePaletteStore.setState(preset.palette)
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
 * Da montare nella finestra di Controllo: al mount ripristina l'autosave (se il progetto
 * è ancora vuoto), poi salva automaticamente ogni modifica con debounce.
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

    const unsubProject = useProjectStore.subscribe(persist)
    const unsubEffects = useEffectsStore.subscribe(persist)
    const unsubPalette = usePaletteStore.subscribe(persist)

    ;(async () => {
      try {
        if (useProjectStore.getState().media != null) return
        const db = await getDb()
        const autosave = await db.get('projects', AUTOSAVE_ID)
        // ricontrolla dopo l'await: se nel frattempo l'utente ha caricato
        // qualcosa, il restore non deve sovrascriverlo
        if (autosave && useProjectStore.getState().media == null) {
          applyProject(autosave)
        }
      } finally {
        restoring = false
      }
    })()

    return () => {
      if (timer) clearTimeout(timer)
      unsubProject()
      unsubEffects()
      unsubPalette()
    }
  }, [])
}
