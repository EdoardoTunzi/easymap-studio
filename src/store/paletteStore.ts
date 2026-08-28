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
}

export function createDefaultPalette(): Palette {
  return {
    enabled: false,
    colors: clonePresetColors('Neon Red'),
    count: PALETTE_STOPS,
    amount: 1,
    activePreset: 'Neon Red',
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
 * Archi di tinta delle famiglie percettive di colore: [inizio, ampiezza] in gradi.
 * La tinta HSL non è percettivamente uniforme — il verde occupa da solo 90° del cerchio e il
 * giallo 25° — quindi un `Math.random() * 360` produceva verde, blu e ciano in metà delle
 * estrazioni. Campionando prima la famiglia e poi un punto nel suo arco, ogni famiglia esce
 * con la stessa frequenza a prescindere da quanto cerchio occupa.
 */
const HUE_FAMILIES: Array<[number, number]> = [
  [345, 30], // rosso
  [15, 30], // arancio
  [45, 25], // giallo
  [70, 90], // verde
  [160, 40], // ciano
  [200, 55], // blu
  [255, 35], // viola
  [290, 55], // magenta
]

/** Rotazione minima (in gradi) fra la tinta di una palette e quella della successiva. */
const MIN_HUE_ROTATION = 70

/** Tentativi di ri-estrazione prima di ripiegare sulla tinta opposta alla precedente. */
const HUE_RETRIES = 8

/** Estrae una tinta in 0..360 con le famiglie di colore equiprobabili. */
function sampleHue(): number {
  const [start, span] = HUE_FAMILIES[Math.floor(Math.random() * HUE_FAMILIES.length)]
  return (start + Math.random() * span) % 360
}

/** Distanza fra due tinte sul percorso più corto (0..180). */
function hueDistance(a: number, b: number): number {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180)
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

/**
 * Genera `count` colori casuali armonici, dal più scuro al più acceso (stessa struttura dei
 * preset: la palette è mappata per luminanza, lo stop 0 è l'ombra e l'ultimo la luce).
 * L'array restituito ha sempre PALETTE_STOPS elementi — gli stop oltre `count` sono riempiti
 * ripetendo l'ultimo, così cambiare "Numero colori" non lascia buchi.
 *
 * `prev` è la palette da cui si sta uscendo (quella a schermo): se passata, la nuova viene
 * generata con una tinta dominante ad almeno MIN_HUE_ROTATION gradi da quella. Senza il
 * vincolo due estrazioni consecutive potevano cadere a pochi gradi di distanza e, col Loop
 * attivo, la sequenza si leggeva come "sempre gli stessi colori" anche se ogni palette era
 * formalmente diversa.
 *
 * Il vincolo (e l'equalizzazione di HUE_WEIGHTS) è ancorato alla tinta **dominante** e non alla
 * tinta base: l'armonia sparpaglia gli stop anche di 240°, quindi allontanare la sola base non
 * sposta il colore che si percepisce. Si sceglie perciò la dominante voluta e si ricava la base
 * per differenza — la media circolare ruota rigidamente con gli stop, perché i pesi dipendono
 * solo dalla lightness, così la palette prodotta ha esattamente la dominante richiesta.
 */
export function randomPaletteColors(count: number = PALETTE_STOPS, prev?: RGB[]): RGB[] {
  const n = Math.max(2, Math.min(PALETTE_STOPS, Math.round(count)))
  const prevHue = prev && prev.length > 0 ? dominantHue(prev) : null

  // tinta dominante voluta: equalizzata e, se c'è una palette da cui uscire, lontana da quella
  let targetHue = sampleHue()
  if (prevHue !== null) {
    let tries = 0
    while (hueDistance(targetHue, prevHue) < MIN_HUE_ROTATION && tries < HUE_RETRIES) {
      targetHue = sampleHue()
      tries++
    }
    if (hueDistance(targetHue, prevHue) < MIN_HUE_ROTATION) {
      targetHue = (prevHue + 180 + (Math.random() * 2 - 1) * (180 - MIN_HUE_ROTATION) + 360) % 360
    }
  }

  const harmony = HARMONIES[Math.floor(Math.random() * HARMONIES.length)]
  const sat = 0.35 + Math.random() * 0.65
  const [lightFrom, lightTo] = TONAL_PROFILES[Math.floor(Math.random() * TONAL_PROFILES.length)]
  const flip = Math.random() < 0.5 ? 1 : -1

  // offset di tinta e lightness di ogni stop, decisi una volta sola: da qui si ricava sia la
  // dominante che avrebbe la palette con base 0, sia la palette finale
  const offsets: number[] = []
  const lights: number[] = []
  for (let i = 0; i < n; i++) {
    const t = n > 1 ? i / (n - 1) : 0
    const jitter = (Math.random() * 2 - 1) * HARMONY_JITTER
    offsets.push(flip * (harmony[i % harmony.length] + jitter))
    // dallo stop scuro all'acceso: è la rampa che la gradient map si aspetta
    lights.push(lightFrom + t * (lightTo - lightFrom))
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

  const ramp: RGB[] = offsets.map((off, i) =>
    hslToRgb((((baseHue + off) % 360) + 360) % 360, sat, lights[i]),
  )

  const last = ramp[ramp.length - 1]
  return Array.from({ length: PALETTE_STOPS }, (_, i) => (i < n ? ramp[i] : ([...last] as RGB)))
}
