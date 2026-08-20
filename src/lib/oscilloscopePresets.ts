/**
 * Preset di forma dell'oscilloscopio: un click (o ⌥1…⌥6) per una figura pronta, invece di
 * comporla a mano con diciassette slider mentre la serata è in corso.
 *
 * Ogni preset definisce l'insieme **completo** dei parametri che determinano la figura, così il
 * risultato non dipende da dove si arrivava prima. Restano fuori di proposito `autoGain` e
 * `reactivity`: dipendono dalla sorgente audio collegata (uscita di linea o microfono in fondo
 * alla sala), non dall'estetica della forma, e vanno tarati una volta sola a inizio serata.
 */

/** Nome dell'unico shader a cui questi preset si applicano (deve combaciare con la riga NAME). */
export const OSCILLOSCOPE_SHADER = 'Audio Oscilloscope'

export interface OscilloscopePreset {
  id: string
  label: string
  /** Cosa aspettarsi, per il tooltip. */
  hint: string
  params: Record<string, number>
}

export const OSCILLOSCOPE_PRESETS: OscilloscopePreset[] = [
  {
    id: 'trace',
    label: 'Traccia',
    hint: "La linea classica dell'oscilloscopio: il tempo scorre, il suono la fa ballare",
    params: {
      shape: 0,
      amplitude: 0.9,
      waveDepth: 0.3,
      spin: 0,
      shapeSides: 5,
      thickness: 1.6,
      glow: 0.8,
      persistence: 0.35,
      traceSamples: 96,
      span: 1,
      sweep: 0.25,
      xyDelay: 0.08,
      grid: 0.25,
      gridDivs: 8,
      jitter: 0,
    },
  },
  {
    id: 'circle',
    label: 'Cerchio',
    hint: 'Anello che respira: il volume lo gonfia, la forma d\'onda ne increspa il bordo',
    params: {
      shape: 1,
      amplitude: 0.95,
      waveDepth: 0.26,
      spin: 0.15,
      shapeSides: 5,
      thickness: 1.4,
      glow: 1,
      persistence: 0.25,
      traceSamples: 120,
      span: 1,
      sweep: 0.35,
      xyDelay: 0.08,
      grid: 0.12,
      gridDivs: 8,
      jitter: 0,
    },
  },
  {
    id: 'flower',
    label: 'Fiore',
    hint: 'Rosa a sei petali che ruota lentamente e sboccia sui colpi',
    params: {
      shape: 2,
      shapeSides: 6,
      amplitude: 1,
      waveDepth: 0.2,
      spin: 0.25,
      thickness: 1.3,
      glow: 1.2,
      persistence: 0.3,
      traceSamples: 150,
      span: 1,
      sweep: 0.4,
      xyDelay: 0.08,
      grid: 0,
      gridDivs: 8,
      jitter: 0,
    },
  },
  {
    id: 'triangle',
    label: 'Triangolo',
    hint: 'Poligono a tre lati, contorno inciso dal suono',
    params: {
      shape: 3,
      shapeSides: 3,
      amplitude: 0.95,
      waveDepth: 0.22,
      spin: -0.12,
      thickness: 1.6,
      glow: 0.9,
      persistence: 0.2,
      traceSamples: 130,
      span: 1,
      sweep: 0.3,
      xyDelay: 0.08,
      grid: 0.1,
      gridDivs: 8,
      jitter: 0,
    },
  },
  {
    id: 'star',
    label: 'Stella',
    hint: 'Cinque punte aguzze e lati dritti, con fosforo lungo che lascia la scia',
    params: {
      shape: 4,
      shapeSides: 5,
      amplitude: 1,
      waveDepth: 0.18,
      spin: 0.3,
      thickness: 1.2,
      glow: 1.3,
      persistence: 0.45,
      traceSamples: 150,
      span: 1,
      sweep: 0.5,
      xyDelay: 0.08,
      grid: 0,
      gridDivs: 8,
      jitter: 0.04,
    },
  },
  {
    id: 'lissajous',
    label: 'Lissajous',
    hint: 'Piano XY: la figura è disegnata dal segnale stesso, cambia con la musica',
    params: {
      shape: 5,
      amplitude: 1,
      waveDepth: 0,
      spin: 0,
      shapeSides: 5,
      thickness: 1.4,
      glow: 1.1,
      persistence: 0.15,
      traceSamples: 140,
      span: 1,
      sweep: 0.25,
      xyDelay: 0.12,
      grid: 0.1,
      gridDivs: 8,
      jitter: 0,
    },
  },
]
