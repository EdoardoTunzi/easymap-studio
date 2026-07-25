import { useLayersStore } from '../store/layersStore'
import { isFullyOpaque } from './mediaDetect'

const DEFAULT_STAGE_URL = '/default-stage.png'
const DEFAULT_STAGE_NAME = 'Default Stage'
const SEEN_KEY = 'easyvj-default-stage-seen'
const AUTO_LUMA_KEY = 0.12

/**
 * Carica l'asset dimostrativo `public/default-stage.png` sul layer attivo, ma solo alla
 * primissima apertura dell'app in questo browser (mai visto prima, indipendentemente da
 * autosave/progetti): così chi apre EasyMap Studio la prima volta trova subito qualcosa da testare,
 * senza dover cercare o caricare un'immagine propria. Va chiamata solo quando la scena è vuota.
 */
export async function loadDefaultStageIfFirstVisit(): Promise<void> {
  if (localStorage.getItem(SEEN_KEY)) return
  // segna subito "visto": evita ritentativi a ogni reload se il fetch fallisce
  localStorage.setItem(SEEN_KEY, '1')

  try {
    const response = await fetch(DEFAULT_STAGE_URL)
    if (!response.ok) return
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)

    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('default stage image failed to load'))
      img.src = url
    })

    // ricontrolla dopo gli await: se nel frattempo l'utente ha già caricato un media
    // proprio, non sovrascriverlo
    const { getActiveLayer, setActiveMedia, setActiveLumaKey, requestFit } =
      useLayersStore.getState()
    if (getActiveLayer()?.media != null) {
      URL.revokeObjectURL(url)
      return
    }

    setActiveMedia({
      id: crypto.randomUUID(),
      name: DEFAULT_STAGE_NAME,
      url,
      type: 'image',
      width: img.naturalWidth,
      height: img.naturalHeight,
      blob,
    })
    setActiveLumaKey(isFullyOpaque(img) ? AUTO_LUMA_KEY : 0)
    requestFit()
  } catch (err) {
    console.warn('[EasyMap Studio] impossibile caricare l\'asset di default:', err)
  }
}
