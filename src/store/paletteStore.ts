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

/** Schemi di armonia usati dal generatore casuale, in gradi di tinta rispetto alla base. */
const HARMONIES: number[][] = [
  [0, 30, 60, 90, 120], // analoga: tinte vicine, molto coesa
  [0, 180, 30, 210, 60], // complementare: due poli opposti
  [0, 120, 240, 60, 300], // triadica: massimo contrasto cromatico
  [0, 150, 210, 30, 180], // split-complementare
  [0, 15, 345, 30, 330], // monocromatica: variazioni sulla stessa tinta
]

/**
 * Genera `count` colori casuali armonici, dal più scuro al più acceso (stessa struttura dei
 * preset: la palette è mappata per luminanza, lo stop 0 è l'ombra e l'ultimo la luce).
 * L'array restituito ha sempre PALETTE_STOPS elementi — gli stop oltre `count` sono riempiti
 * ripetendo l'ultimo, così cambiare "Numero colori" non lascia buchi.
 */
export function randomPaletteColors(count: number = PALETTE_STOPS): RGB[] {
  const n = Math.max(2, Math.min(PALETTE_STOPS, Math.round(count)))
  const baseHue = Math.random() * 360
  const harmony = HARMONIES[Math.floor(Math.random() * HARMONIES.length)]
  const sat = 0.75 + Math.random() * 0.25
  const flip = Math.random() < 0.5 ? 1 : -1

  const ramp: RGB[] = Array.from({ length: n }, (_, i) => {
    const t = n > 1 ? i / (n - 1) : 0
    const h = (((baseHue + flip * harmony[i % harmony.length]) % 360) + 360) % 360
    // dal quasi-nero all'acceso: è la rampa che la gradient map si aspetta
    const light = 0.07 + t * 0.62
    return hslToRgb(h, sat, light)
  })

  const last = ramp[ramp.length - 1]
  return Array.from({ length: PALETTE_STOPS }, (_, i) => (i < n ? ramp[i] : ([...last] as RGB)))
}
