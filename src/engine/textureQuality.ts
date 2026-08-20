import * as THREE from 'three'

/**
 * Filtraggio anisotropico delle texture di contenuto.
 *
 * Nel projection mapping il quad è **sempre** deformato in prospettiva dal corner-pin: la texture
 * viene campionata lungo direzioni molto diverse fra loro sui due assi, ed è esattamente il caso in
 * cui il mip-mapping isotropo (quello di default, `anisotropy = 1`) sfoca. Il lato inclinato di una
 * statua perde dettaglio molto prima di quello frontale, e a occhio si legge come "fuori fuoco",
 * non come un artefatto di filtraggio.
 *
 * Il valore massimo lo conosce solo il renderer, che nasce col Canvas — cioè *dopo* che qualche
 * texture può già essere stata creata (il media di default parte al montaggio). Per questo le
 * texture si registrano qui e vengono aggiornate a ritroso quando il valore arriva.
 */

let maxAnisotropy = 1

/** Texture registrate in attesa del valore reale, o già impostate e da riallineare se cambia. */
const tracked = new Set<THREE.Texture>()

/** Da chiamare una volta col renderer montato (vedi `TextureQualityProbe`). */
export function setMaxAnisotropy(value: number) {
  const next = Math.max(1, Math.floor(value))
  if (next === maxAnisotropy) return
  maxAnisotropy = next
  for (const texture of tracked) apply(texture)
}

export function getMaxAnisotropy(): number {
  return maxAnisotropy
}

function apply(texture: THREE.Texture) {
  if (texture.anisotropy === maxAnisotropy) return
  texture.anisotropy = maxAnisotropy
  // il parametro vive nella texture GL: senza questo flag l'oggetto già caricato non lo rilegge
  texture.needsUpdate = true
}

/**
 * Registra una texture di contenuto perché usi la miglior qualità di filtraggio disponibile.
 * Da chiamare alla creazione; `releaseTexture` alla dismissione.
 */
export function trackTexture(texture: THREE.Texture): THREE.Texture {
  tracked.add(texture)
  apply(texture)
  return texture
}

export function releaseTexture(texture: THREE.Texture) {
  tracked.delete(texture)
}

// Il registro vive nel modulo: un hot-replace lo sdoppierebbe lasciando le texture già create
// agganciate alla copia vecchia (che nessuno aggiornerebbe più).
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
