import {
  findPaletteCategory,
  type PaletteCategory,
  type PaletteCategoryId,
} from './paletteCategories'

export type RGB = [number, number, number]

export interface PalettePreset {
  name: string
  /** Da scuro (stop 0) a fluorescente (ultimo stop): mappato per luminanza sull'effetto. */
  colors: RGB[]
}

/** Palette fluorescenti a tinta calda, ognuna da scuro → acceso. */
export const PALETTE_PRESETS: PalettePreset[] = [
  {
    name: 'Neon Red',
    colors: [[0.04, 0.0, 0.02], [0.4, 0.0, 0.05], [1.0, 0.1, 0.1], [1.0, 0.5, 0.15], [1.0, 0.95, 0.6]],
  },
  {
    name: 'Jungle Green',
    colors: [[0.0, 0.05, 0.02], [0.0, 0.3, 0.1], [0.15, 0.9, 0.2], [0.5, 1.0, 0.3], [0.9, 1.0, 0.7]],
  },
  {
    name: 'Neon Blue',
    colors: [[0.0, 0.02, 0.08], [0.0, 0.12, 0.45], [0.1, 0.45, 1.0], [0.35, 0.85, 1.0], [0.8, 1.0, 1.0]],
  },
  {
    name: 'Dark Violet',
    colors: [[0.03, 0.0, 0.06], [0.2, 0.0, 0.32], [0.55, 0.1, 0.85], [0.85, 0.35, 1.0], [1.0, 0.75, 1.0]],
  },
  {
    name: 'Earth',
    colors: [[0.05, 0.03, 0.0], [0.3, 0.16, 0.05], [0.6, 0.35, 0.12], [0.82, 0.6, 0.3], [1.0, 0.92, 0.65]],
  },
  {
    name: 'Jungle',
    colors: [[0.0, 0.05, 0.03], [0.05, 0.2, 0.1], [0.2, 0.5, 0.15], [0.6, 0.72, 0.2], [0.95, 0.95, 0.5]],
  },
  {
    name: 'Fire',
    colors: [[0.05, 0.0, 0.0], [0.5, 0.05, 0.0], [1.0, 0.3, 0.0], [1.0, 0.72, 0.1], [1.0, 1.0, 0.75]],
  },
]

export const PALETTE_STOPS = 5
export const CUSTOM_PRESET = 'Custom'

export function clonePresetColors(name: string): RGB[] {
  const preset = PALETTE_PRESETS.find((p) => p.name === name) ?? PALETTE_PRESETS[0]
  return preset.colors.map((c) => [...c] as RGB)
}

/** Palette per-layer (gradient map): stato salvato dentro ogni layer. */
export interface Palette {
  /** Se attiva, l'effetto viene ricolorato con la palette (gradient map per luminanza). */
  enabled: boolean
  /** 5 stop di colore (r,g,b in 0..1). */
  colors: RGB[]
  /** Numero di stop attivi (2..5). */
  count: number
  /** Quanto la palette sostituisce i colori originali (0..1). */
  amount: number
  /** Nome del preset attivo o "Custom" se l'utente ha modificato i colori. */
  activePreset: string
  /**
   * Categoria che guida il generatore casuale e il Loop di questo layer ('all' = nessun vincolo).
   * Opzionale: i progetti salvati prima di questo campo la leggono come `undefined`, trattata
   * come 'all', quindi non serve migrare il database.
   */
  category?: PaletteCategoryId
}

export function createDefaultPalette(): Palette {
  return {
    enabled: false,
    colors: clonePresetColors('Neon Red'),
    count: PALETTE_STOPS,
    amount: 1,
    activePreset: 'Neon Red',
    category: 'all',
  }
}

// ---- Helper colore condivisi (usati da PalettePanel, EffectsPanel, PlaylistBar) ----

export function rgbToHex([r, g, b]: RGB): string {
  const to = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

export function hexToRgb(hex: string): RGB {
  const n = hex.replace('#', '')
  return [
    parseInt(n.slice(0, 2), 16) / 255,
    parseInt(n.slice(2, 4), 16) / 255,
    parseInt(n.slice(4, 6), 16) / 255,
  ]
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0), f(8), f(4)]
}

function rgbToHsl([r, g, b]: RGB): [number, number, number] {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return [0, 0, l] // grigio: la tinta non è definita
  const s = d / (1 - Math.abs(2 * l - 1))
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, s, l]
}

/**
 * Dissolvenza fra due palette (t = 0 → `from`, 1 → `to`), usata dal loop casuale.
 * L'interpolazione avviene in HSL e non in RGB: in RGB due tinte opposte si attraversano
 * passando per un grigio slavato, mentre qui la tinta ruota sul percorso più corto e la palette
 * resta satura per tutta la transizione.
 */
export function lerpPaletteColors(from: RGB[], to: RGB[], t: number): RGB[] {
  const k = Math.max(0, Math.min(1, t))
  const fallback: RGB = [0, 0, 0]
  return Array.from({ length: PALETTE_STOPS }, (_, i) => {
    const [h1, s1, l1] = rgbToHsl(from[i] ?? from[from.length - 1] ?? fallback)
    const [h2, s2, l2] = rgbToHsl(to[i] ?? to[to.length - 1] ?? fallback)
    let dh = h2 - h1
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
    return hslToRgb((((h1 + dh * k) % 360) + 360) % 360, s1 + (s2 - s1) * k, l1 + (l2 - l1) * k)
  })
}

/**
 * Schemi di armonia usati dal generatore casuale, in gradi di tinta rispetto alla base.
 * Gli offset sono il *centro* dello schema: al momento della generazione ognuno riceve un
 * jitter di ±HARMONY_JITTER, altrimenti due estrazioni con la stessa armonia darebbero
 * esattamente gli stessi rapporti cromatici e si leggerebbero come la stessa palette.
 */
const HARMONIES: number[][] = [
  [0, 30, 60, 90, 120], // analoga: tinte vicine, molto coesa
  [0, 180, 30, 210, 60], // complementare: due poli opposti
  [0, 120, 240, 60, 300], // triadica: massimo contrasto cromatico
  [0, 150, 210, 30, 180], // split-complementare
  [0, 15, 345, 30, 330], // monocromatica: variazioni sulla stessa tinta
]

/** Scostamento casuale applicato a ogni offset di armonia, in gradi. */
const HARMONY_JITTER = 10

/**
 * Profili tonali della rampa: [lightness dello stop 0, lightness dell'ultimo].
 * Prima la rampa era una sola (0.07 → 0.69) e la saturazione stava sempre fra 0.75 e 1: ogni
 * palette casuale aveva quindi la stessa identica curva "quasi-nero → tinta satura → chiaro",
 * e a cambiare era solo la tinta. Con più profili escono anche palette cupe, tenui e high-key.
 */
const TONAL_PROFILES: Array<[number, number]> = [
  [0.05, 0.45], // cupa: resta bassa, buona sugli shader che saturano verso il bianco
  [0.07, 0.69], // standard: la rampa storica
  [0.25, 0.85], // high-key: nessun nero, tutto in alto
  [0.04, 0.8], // contrastata: massima escursione
]

/**
 * Archi di tinta delle famiglie percettive di colore: [inizio, ampiezza, peso].
 * La tinta HSL non è percettivamente uniforme — il verde occupa da solo 90° del cerchio e il
 * giallo 25° — quindi un `Math.random() * 360` produceva verde, blu e ciano in metà delle
 * estrazioni. Campionando prima la famiglia e poi un punto nel suo arco, ogni famiglia esce
 * con la stessa frequenza a prescindere da quanto cerchio occupa.
 */
const HUE_FAMILIES: Array<[number, number, number]> = [
  [345, 30, 1], // rosso
  [15, 30, 1], // arancio
  [45, 25, 1], // giallo
  [70, 90, 1], // verde
  [160, 40, 1], // ciano
  [200, 55, 1], // blu
  [255, 35, 1], // viola
  [290, 55, 1], // magenta
]

/** Rotazione minima (in gradi) fra la tinta di una palette e quella della successiva. */
const MIN_HUE_ROTATION = 70

/**
 * Frazione dell'arco di una categoria usata come rotazione minima al suo interno.
 * Dentro una categoria i 70° pieni non sono applicabili: Forest vive in ~190° di arco totale e
 * Space in ~160°, quindi imporre la rotazione piena spingerebbe fuori categoria a giri alterni,
 * o farebbe rimbalzare la palette fra due soli poli. Dentro una categoria la varietà fra un
 * tick e l'altro la portano soprattutto saturazione e profilo tonale, che restano liberi.
 */
const CATEGORY_ROTATION_SHARE = 0.35

/** Tentativi di ri-estrazione prima di ripiegare sulla tinta opposta alla precedente. */
const HUE_RETRIES = 8

/** Saturazione del generatore libero: larga, così escono anche palette tenui e non solo fluo. */
const FREE_SAT_RANGE: [number, number] = [0.35, 1.0]

/** Parametri effettivi di un'estrazione: quelli della categoria, o i liberi se non c'è. */
interface GenerationProfile {
  hueArcs: Array<[number, number, number]>
  satRange: [number, number]
  tonalProfiles: Array<[number, number]>
  harmonies: number[][]
  minRotation: number
  lightCurve: number
}

function profileFor(category: PaletteCategory | null): GenerationProfile {
  if (!category) {
    return {
      hueArcs: HUE_FAMILIES,
      satRange: FREE_SAT_RANGE,
      tonalProfiles: TONAL_PROFILES,
      harmonies: HARMONIES,
      minRotation: MIN_HUE_ROTATION,
      lightCurve: 1,
    }
  }
  const span = category.hueArcs.reduce((sum, [, width]) => sum + width, 0)
  return {
    hueArcs: category.hueArcs,
    satRange: category.satRange,
    tonalProfiles: category.tonalProfiles,
    harmonies: category.harmonies,
    minRotation: Math.min(MIN_HUE_ROTATION, span * CATEGORY_ROTATION_SHARE),
    lightCurve: category.lightCurve ?? 1,
  }
}

/** Estrae una tinta in 0..360 scegliendo prima un arco (secondo i pesi) e poi un punto dentro. */
function sampleHue(arcs: Array<[number, number, number]>): number {
  const total = arcs.reduce((sum, [, , weight]) => sum + weight, 0)
  let x = Math.random() * total
  let i = 0
  while (x > arcs[i][2] && i < arcs.length - 1) {
    x -= arcs[i][2]
    i++
  }
  const [start, width] = arcs[i]
  return (start + Math.random() * width) % 360
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}

/** Distanza fra due tinte sul percorso più corto (0..180). */
function hueDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180)
}

/** Luminanza percettiva, la stessa che la gradient map usa per indicizzare la rampa. */
function luma([r, g, b]: RGB): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * Tinta dominante di una palette: media circolare degli stop, pesata per saturazione e
 * lightness. Serve al generatore per sapere da cosa allontanarsi; pesare gli stop evita che
 * uno stop quasi nero o quasi grigio (tinta di fatto non percepibile) sposti il risultato.
 * Restituisce null se la palette non ha nessuno stop con tinta leggibile.
 */
export function dominantHue(colors: RGB[]): number | null {
  let x = 0
  let y = 0
  for (const c of colors) {
    const [h, s, l] = rgbToHsl(c)
    const w = s * (1 - Math.abs(2 * l - 1))
    if (w <= 0) continue
    x += Math.cos((h * Math.PI) / 180) * w
    y += Math.sin((h * Math.PI) / 180) * w
  }
  if (x === 0 && y === 0) return null
  return (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360
}

/**
 * Peso percettivo di uno stop nel calcolo della tinta dominante: massimo a mezza luce, nullo
 * sul nero e sul bianco, dove la tinta non si legge. La saturazione è costante lungo la rampa,
 * quindi come fattore comune non cambia la media e si può omettere.
 */
function stopWeight(light: number): number {
  return 1 - Math.abs(2 * light - 1)
}

/** Sceglie la tinta dominante della prossima palette: nel profilo e lontana dalla precedente. */
function nextHue(profile: GenerationProfile, prevHue: number | null): number {
  let hue = sampleHue(profile.hueArcs)
  if (prevHue === null) return hue
  let tries = 0
  while (hueDistance(hue, prevHue) < profile.minRotation && tries < HUE_RETRIES) {
    hue = sampleHue(profile.hueArcs)
    tries++
  }
  if (hueDistance(hue, prevHue) < profile.minRotation) {
    // nessuna estrazione è caduta abbastanza lontano: si va sul lato opposto
    return (prevHue + 180 + (Math.random() * 2 - 1) * (180 - profile.minRotation) + 360) % 360
  }
  return hue
}

/**
 * Campiona `n` stop equispaziati lungo una rampa di colori, interpolando in HSL sul percorso
 * più corto della tinta. Serve a portare una palette curata (che ha 4 o 5 colori) al numero di
 * stop richiesto dall'utente, sia riducendolo che aumentandolo.
 */
function resampleRamp(colors: RGB[], n: number): RGB[] {
  if (colors.length === 0) return []
  const hsl = colors.map(rgbToHsl)
  if (hsl.length === 1) return Array.from({ length: n }, () => hslToRgb(...hsl[0]))
  return Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? (i / (n - 1)) * (hsl.length - 1) : 0
    const lo = Math.min(Math.floor(t), hsl.length - 2)
    const f = t - lo
    const [h1, s1, l1] = hsl[lo]
    const [h2, s2, l2] = hsl[lo + 1]
    let dh = h2 - h1
    if (dh > 180) dh -= 360
    if (dh < -180) dh += 360
    return hslToRgb((((h1 + dh * f) % 360) + 360) % 360, s1 + (s2 - s1) * f, l1 + (l2 - l1) * f)
  })
}

/**
 * Porta una palette curata nella forma che la gradient map si aspetta: `count` stop, ordinati
 * per luminanza crescente, con l'escursione rimappata sul profilo tonale scelto.
 *
 * Entrambi i passaggi sono necessari. L'ordinamento perché le palette da galleria quasi mai
 * hanno luminanza monotona (alcune sono decrescenti): usate così com'erano, la gradient map
 * inverte il contrasto e le zone chiare dell'effetto diventano scure. Il rimappaggio perché
 * l'escursione pubblicata è spesso troppo stretta — una halloween tipica sta fra 0.12 e 0.47 —
 * e sull'effetto arriverebbe tutta scura, senza alte luci. Tinta e saturazione restano intatte:
 * si tocca solo la lightness, quindi il carattere della palette non cambia.
 */
export function normalizeCuratedColors(
  hexes: string[],
  count: number,
  tonal: [number, number],
): RGB[] {
  const ordered = hexes.map(hexToRgb).sort((a, b) => luma(a) - luma(b))
  const sampled = resampleRamp(ordered, count).map(rgbToHsl)
  const lights = sampled.map(([, , l]) => l)
  const lo = Math.min(...lights)
  const hi = Math.max(...lights)
  const [t0, t1] = tonal
  return sampled.map(([h, s, l], i) => {
    // rampa piatta (tutti gli stop alla stessa luce): si distribuisce linearmente
    const k = hi - lo > 1e-4 ? (l - lo) / (hi - lo) : count > 1 ? i / (count - 1) : 0
    return hslToRgb(h, s, t0 + k * (t1 - t0))
  })
}

/**
 * Genera `count` colori casuali armonici, dal più scuro al più acceso (stessa struttura dei
 * preset: la palette è mappata per luminanza, lo stop 0 è l'ombra e l'ultimo la luce).
 * L'array restituito ha sempre PALETTE_STOPS elementi — gli stop oltre `count` sono riempiti
 * ripetendo l'ultimo, così cambiare "Numero colori" non lascia buchi.
 *
 * `prev` è la palette da cui si sta uscendo (quella a schermo): se passata, la nuova viene
 * generata con una tinta dominante ad almeno `minRotation` gradi da quella. Senza il vincolo
 * due estrazioni consecutive potevano cadere a pochi gradi di distanza e, col Loop attivo, la
 * sequenza si leggeva come "sempre gli stessi colori" anche se ogni palette era diversa.
 *
 * `category` restringe tinte, saturazione, rampe e armonie a un genere (Forest, Neon, …) e fa
 * pescare ogni tanto dal seed set curato di quel genere: il procedurale porta la varietà, le
 * curate l'identità riconoscibile della categoria.
 *
 * Il vincolo di rotazione (e l'equalizzazione delle tinte) è ancorato alla tinta **dominante**
 * e non alla tinta base: l'armonia sparpaglia gli stop anche di 240°, quindi allontanare la
 * sola base non sposta il colore che si percepisce. Si sceglie perciò la dominante voluta e si
 * ricava la base per differenza — la media circolare ruota rigidamente con gli stop, perché i
 * pesi dipendono solo dalla lightness, così la palette prodotta ha esattamente quella dominante.
 */
export function randomPaletteColors(
  count: number = PALETTE_STOPS,
  prev?: RGB[],
  category?: PaletteCategoryId,
): RGB[] {
  const n = Math.max(2, Math.min(PALETTE_STOPS, Math.round(count)))
  const cat = findPaletteCategory(category)
  const profile = profileFor(cat)
  const prevHue = prev && prev.length > 0 ? dominantHue(prev) : null

  const ramp = cat && Math.random() < cat.curatedShare
    ? pickCurated(cat, n, prevHue, profile.minRotation)
    : generateRamp(n, profile, nextHue(profile, prevHue))

  /*
   * La gradient map indicizza per luminanza percettiva, non per lightness HSL, e le due non
   * coincidono: a parità di lightness un giallo è molto più luminoso di un blu. Con le armonie
   * che spostano la tinta fra uno stop e l'altro, una rampa monotona in HSL può quindi non
   * esserlo in luminanza — misurato: capitava a un terzo delle estrazioni — e lì la gradient
   * map inverte il contrasto a metà rampa. Riordinare non altera né i colori scelti né la tinta
   * dominante (è una media, indipendente dall'ordine): mette solo l'ombra davvero all'inizio.
   */
  ramp.sort((a, b) => luma(a) - luma(b))

  const last = ramp[ramp.length - 1]
  return Array.from({ length: PALETTE_STOPS }, (_, i) => (i < n ? ramp[i] : ([...last] as RGB)))
}

/** Quante palette curate provare prima di accontentarsi della più lontana trovata. */
const CURATED_CANDIDATES = 6

/**
 * Pesca una palette dal seed set della categoria e la normalizza. Il profilo tonale è estratto
 * a caso fra quelli della categoria, quindi la stessa palette curata non ritorna mai identica:
 * 14 palette × 3 rampe danno 42 esiti distinguibili, che è ciò che tiene vivo il Loop.
 *
 * Si prova più di una candidata per rispettare la rotazione minima da `prevHue`, ma il vincolo
 * non è imponibile: dentro una categoria stretta come Forest le curate sono tutte verdi e
 * marroni, e nessuna dista 66° dalla precedente. In quel caso si prende la più lontana fra
 * quelle viste e lo stacco lo porta il profilo tonale, che è comunque riestratto ogni volta.
 */
function pickCurated(
  category: PaletteCategory,
  n: number,
  prevHue: number | null,
  minRotation: number,
): RGB[] {
  let best: RGB[] = normalizeCuratedColors(pick(category.curated), n, pick(category.tonalProfiles))
  if (prevHue === null) return best
  let bestDistance = -1
  for (let i = 0; i < CURATED_CANDIDATES; i++) {
    const candidate =
      i === 0
        ? best
        : normalizeCuratedColors(pick(category.curated), n, pick(category.tonalProfiles))
    const hue = dominantHue(candidate)
    const distance = hue === null ? 180 : hueDistance(hue, prevHue)
    if (distance >= minRotation) return candidate
    if (distance > bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

/** Costruisce la rampa procedurale con la dominante richiesta. */
function generateRamp(n: number, profile: GenerationProfile, targetHue: number): RGB[] {
  const harmony = pick(profile.harmonies)
  const [satLo, satHi] = profile.satRange
  const sat = satLo + Math.random() * (satHi - satLo)
  const [lightFrom, lightTo] = pick(profile.tonalProfiles)
  const flip = Math.random() < 0.5 ? 1 : -1

  // offset di tinta e lightness di ogni stop, decisi una volta sola: da qui si ricava sia la
  // dominante che avrebbe la palette con base 0, sia la palette finale
  const offsets: number[] = []
  const lights: number[] = []
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const jitter = (Math.random() * 2 - 1) * HARMONY_JITTER
    offsets.push(flip * (harmony[i % harmony.length] + jitter))
    // dallo stop scuro all'acceso: è la rampa che la gradient map si aspetta. Con lightCurve > 1
    // la salita è ritardata, così restano più stop nell'ombra e l'ultimo fa da accento.
    lights.push(lightFrom + Math.pow(t, profile.lightCurve) * (lightTo - lightFrom))
  }

  let x = 0
  let y = 0
  for (let i = 0; i < n; i++) {
    const w = stopWeight(lights[i])
    x += Math.cos((offsets[i] * Math.PI) / 180) * w
    y += Math.sin((offsets[i] * Math.PI) / 180) * w
  }
  // dominante della forma con base 0; se gli offset si annullano fra loro la base è indifferente
  const shape = x === 0 && y === 0 ? 0 : ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  const baseHue = ((targetHue - shape) % 360 + 360) % 360

  return offsets.map((off, i) => hslToRgb((((baseHue + off) % 360) + 360) % 360, sat, lights[i]))
}
