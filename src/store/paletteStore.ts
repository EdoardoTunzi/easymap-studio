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
