/**
 * Categorie di palette per il generatore casuale.
 *
 * Ogni categoria è definita da due cose insieme:
 *
 * - un **profilo generativo** (archi di tinta ammessi con i loro pesi, saturazione, rampe di
 *   lightness, armonie) che guida `randomPaletteColors`, e
 * - un **seed set curato** di palette reali di quel genere, da cui si pesca ogni tanto.
 *
 * Servono entrambi. Solo curate: con ~14 palette e il Loop a 2s le si esaurisce in mezzo minuto
 * e la sequenza ricomincia. Solo procedurale: categorie come Forest e Autumn hanno un'identità
 * fatta di rapporti specifici (verde desaturato + marrone caldo) che la generazione libera non
 * centra sempre. Il seed set fa da àncora di riconoscibilità, il profilo porta la varietà.
 *
 * Le palette curate sono scritte **nell'ordine in cui si trovano pubblicate**, non ordinate per
 * luminanza: la gradient map ha bisogno di una rampa monotona, quindi vengono riordinate e
 * rimappate al momento dell'uso (vedi `normalizeCuratedColors` in `paletteStore.ts`). La
 * maggior parte delle palette da galleria non è monotona — alcune sono decrescenti — perché lì
 * i colori sono pensati come campiture affiancate, non come rampa.
 */

export type PaletteCategoryId = 'all' | 'forest' | 'autumn' | 'happy' | 'space' | 'dark' | 'neon'

export interface PaletteCategory {
  id: PaletteCategoryId
  label: string
  /** Testo del tooltip: che tipo di colori aspettarsi. */
  hint: string
  /** Archi di tinta ammessi: [inizio in gradi, ampiezza in gradi, peso relativo]. */
  hueArcs: Array<[number, number, number]>
  /** Intervallo di saturazione da cui estrarre (0..1). */
  satRange: [number, number]
  /** Rampe di lightness ammesse: [lightness dello stop scuro, lightness dell'ultimo]. */
  tonalProfiles: Array<[number, number]>
  /**
   * Esponente della progressione di lightness nella generazione procedurale (1 = lineare).
   * Sopra 1 la rampa resta bassa a lungo e sale solo sull'ultimo stop: è la struttura "fondo
   * scurissimo più un accento brillante" delle palette notturne, che una rampa lineare non sa
   * produrre. Non si applica alle palette curate, che quella distribuzione ce l'hanno già nei
   * dati: applicarla anche lì la schiaccerebbe due volte.
   */
  lightCurve?: number
  /** Schemi di armonia ammessi, in gradi rispetto alla tinta base. */
  harmonies: number[][]
  /** Quota di estrazioni che pesca dal seed set invece di generare (0..1). */
  curatedShare: number
  /** Palette di riferimento del genere, in hex e nell'ordine pubblicato. */
  curated: string[][]
}

// Armonie riusate dai profili: tinte vicine per le categorie coese, poli opposti per quelle
// che vivono di contrasto.
const H_ANALOGA = [0, 30, 60, 90, 120]
const H_MONO = [0, 15, 345, 30, 330]
const H_SPLIT = [0, 150, 210, 30, 180]
const H_COMPLEMENTARE = [0, 180, 30, 210, 60]
const H_TRIADICA = [0, 120, 240, 60, 300]

export const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    id: 'forest',
    label: 'Forest',
    hint: 'Verdi e marroni di sottobosco, poco saturi, con gialli e ocra',
    // verde e marrone dominano, giallo di sottobosco, un viola raro da fiore/ombra
    hueArcs: [
      [70, 90, 4],
      [15, 40, 3],
      [45, 25, 1.5],
      [255, 35, 0.4],
    ],
    satRange: [0.18, 0.62], // bassa: la foresta non è fluo, e qui nascono anche i grigi
    tonalProfiles: [
      [0.05, 0.45],
      [0.07, 0.6],
      [0.1, 0.72],
    ],
    harmonies: [H_ANALOGA, H_MONO, H_SPLIT],
    curatedShare: 0.35,
    curated: [
      ['#283618', '#606C38', '#BC6C25', '#DDA15E', '#FEFAE0'],
      ['#132A13', '#31572C', '#4F772D', '#90A955', '#ECF39E'],
      ['#1B4332', '#2D6A4F', '#40916C', '#74C69D', '#B7E4C7'],
      ['#0B2818', '#1E3F20', '#345830', '#6B8F71', '#D8E2DC'],
      ['#2C1810', '#5C3A21', '#8B5A2B', '#B08968', '#DDB892'],
      ['#233D2C', '#3E5C41', '#7A8450', '#A4AC86', '#C2C5AA'],
      ['#1E2D24', '#3B5249', '#6B8F71', '#A5C4A0', '#E3EED4'],
      ['#12261E', '#274029', '#5F7B4A', '#9BAE6E', '#E9EDC9'],
      ['#1D1E18', '#3A3B2E', '#6A6F4C', '#9FA86A', '#D6D58E'],
      ['#0E1B12', '#27391F', '#55682E', '#8A9A5B', '#CFD8A8'],
      ['#261C15', '#4A3B2A', '#7D6544', '#A98F6B', '#D4C4A8'],
      ['#152A1E', '#2F4B36', '#587B4C', '#8FA968', '#CDD9A0'],
      ['#1C1B22', '#33302E', '#4A5D3F', '#7D8C5C', '#B9A44C'],
      ['#22201F', '#3D4A3B', '#6B7A4F', '#6B5B7B', '#9A8C5E'],
    ],
  },
  {
    id: 'autumn',
    label: 'Autumn',
    hint: 'Arancio bruciato, rosso e zucca su fondo notturno, in chiave Halloween',
    // arancio e rosso bruciato, giallo zucca, il viola notturno di Halloween
    hueArcs: [
      [15, 30, 4],
      [345, 30, 3],
      [45, 25, 2],
      [285, 30, 1],
    ],
    satRange: [0.55, 1.0],
    tonalProfiles: [
      [0.04, 0.55],
      [0.05, 0.68],
      [0.03, 0.45],
    ],
    harmonies: [H_ANALOGA, H_MONO, H_COMPLEMENTARE],
    curatedShare: 0.35,
    curated: [
      ['#2D132C', '#801336', '#C72C41', '#EE4540', '#F5B461'],
      ['#1A1423', '#3D2C4A', '#6B2D5B', '#C1443C', '#F58F29'],
      ['#0D0D0D', '#2B1B17', '#7A3E12', '#D45F14', '#F2A65A'],
      ['#1B1212', '#4A1E10', '#8C3B0F', '#D96C0A', '#F0B428'],
      ['#241023', '#5B1A3A', '#96341F', '#E06D28', '#F7C548'],
      ['#1C1C1C', '#3B2416', '#6E3A0F', '#C2570C', '#FF8C1A'],
      ['#190F1F', '#44224E', '#7A2E5C', '#B34733', '#E88A2A'],
      ['#2A1A0E', '#573015', '#8F4A16', '#C97B22', '#EFC05B'],
      ['#120D14', '#3A1E2E', '#6E2C2C', '#A84B18', '#E2932B'],
      ['#1F0F0A', '#4C2211', '#7E3B12', '#B8600F', '#E89A2C'],
      ['#231018', '#5A1E2E', '#8E2F26', '#C55A1E', '#EDA13B'],
      ['#0F0A0F', '#33162B', '#6B2440', '#A83E2A', '#DD7C22'],
      ['#261508', '#512A0C', '#87450F', '#BE6C14', '#F0A93B'],
      ['#1A0E1B', '#452240', '#7C2F4A', '#B14B2A', '#E5892C'],
    ],
  },
  {
    id: 'happy',
    label: 'Happy',
    hint: 'Colori pieni e luminosi: corallo, giallo, turchese, rosa',
    // tutto il cerchio, ma sempre luminoso e saturo: il carattere è tonale prima che cromatico
    hueArcs: [
      [45, 25, 2.5],
      [15, 30, 2],
      [330, 45, 2],
      [160, 40, 2],
      [200, 55, 1.5],
      [70, 90, 1.2],
      [255, 35, 1],
    ],
    satRange: [0.6, 1.0],
    tonalProfiles: [
      [0.28, 0.85],
      [0.35, 0.9],
      [0.22, 0.8],
    ],
    harmonies: [H_TRIADICA, H_COMPLEMENTARE, H_SPLIT],
    curatedShare: 0.35,
    curated: [
      ['#6A2C70', '#B83B5E', '#F08A5D', '#F9ED69'],
      ['#2D4059', '#EA5455', '#F07B3F', '#FFD460'],
      ['#364F6B', '#3FC1C9', '#F5F5F5', '#FC5185'],
      ['#1B1F3B', '#4E4C67', '#7A4E9B', '#F76B8A', '#FFD3B6'],
      ['#22223B', '#4A4E8C', '#3FC1C9', '#FFD460', '#FFF3B0'],
      ['#2B2D42', '#8D99AE', '#EF233C', '#FFB703', '#FFE8A3'],
      ['#3A2E5C', '#6C5B9B', '#E86A92', '#FFA69E', '#FFF1C1'],
      ['#213A5C', '#4361EE', '#4CC9F0', '#F72585', '#FFD166'],
      ['#2F2440', '#7B4B94', '#F0648C', '#FFA45B', '#FFE29A'],
      ['#1F3A5F', '#3E92CC', '#F2545B', '#FFD166', '#FFF6C2'],
      ['#33272A', '#8E4162', '#E86A58', '#F3B562', '#F9F871'],
      ['#2A1E3F', '#6A4C93', '#F45B69', '#FFB100', '#FFE45E'],
      ['#1D3557', '#457B9D', '#A8DADC', '#E63946', '#F1FAEE'],
      ['#2E294E', '#9055A2', '#D499B9', '#E8C1C5', '#F6E4F6'],
    ],
  },
  {
    id: 'space',
    label: 'Space',
    hint: 'Blu profondo e viola da nebulosa, con un ciano come punto di luce',
    // blu profondo e viola, con un ciano da nebulosa come punto di luce
    hueArcs: [
      [200, 55, 4],
      [255, 35, 3],
      [160, 40, 1.5],
      [290, 30, 1.2],
    ],
    satRange: [0.35, 0.9],
    tonalProfiles: [
      [0.02, 0.55],
      [0.03, 0.65],
      [0.02, 0.42],
    ],
    harmonies: [H_ANALOGA, H_MONO, H_SPLIT],
    curatedShare: 0.35,
    curated: [
      ['#0B0C10', '#1F2833', '#45A29E', '#66FCF1', '#C5C6C7'],
      ['#05050F', '#12193B', '#2E4482', '#5A7BD1', '#BFD3FF'],
      ['#010A1A', '#06214A', '#0D4C92', '#2E86D9', '#9FD4FF'],
      ['#0A0612', '#1E1140', '#3E2A82', '#6E4FC8', '#C6B3FF'],
      ['#000000', '#0B1026', '#1B2A6B', '#3D5AAF', '#8FA8E8'],
      ['#02010A', '#141034', '#33296B', '#6B5BB5', '#B9AEE8'],
      ['#060014', '#1A0B3D', '#3B1E7A', '#7A3FD1', '#D0A8FF'],
      ['#000308', '#0A1A2F', '#1B4B6B', '#3A9BBF', '#A8E4F0'],
      ['#04030D', '#15113A', '#2B2A6E', '#4F6BB5', '#A9C9F5'],
      ['#010104', '#0D0F2B', '#232B5C', '#4A5A9E', '#9BAAD8'],
      ['#000206', '#071B33', '#0F3A5C', '#2A6E96', '#8FC2D9'],
      ['#0B0A1E', '#241E4D', '#47379B', '#8A6BD9', '#E0CCFF'],
      ['#020208', '#101838', '#25406B', '#4E7BA8', '#A3CBE0'],
      ['#07030F', '#20103F', '#4A2478', '#8A4FC8', '#D9B3F0'],
    ],
  },
  {
    id: 'dark',
    label: 'Dark',
    hint: 'Poca luce e poca saturazione: il carattere è tonale, non cromatico',
    // qualsiasi tinta: il carattere qui è tonale, non cromatico — poca luce e poca saturazione
    hueArcs: [[0, 360, 1]],
    satRange: [0.1, 0.45],
    // il tetto è alto ma ci si arriva solo sull'ultimo stop (vedi lightCurve): una dark tutta
    // compressa in basso perde l'accento brillante che la rende leggibile, e in proiezione
    // sparirebbe del tutto sulla superficie
    tonalProfiles: [
      [0.02, 0.62],
      [0.03, 0.7],
      [0.02, 0.52],
    ],
    lightCurve: 2.4,
    harmonies: [H_ANALOGA, H_MONO],
    curatedShare: 0.35,
    curated: [
      ['#222831', '#393E46', '#00ADB5', '#EEEEEE'],
      ['#0F0F0F', '#1B1B1B', '#2E2E2E', '#4A4A4A', '#8A8A8A'],
      ['#111111', '#1E1E24', '#2D2D3A', '#44465A', '#6E7191'],
      ['#0A0A0F', '#16161E', '#262633', '#3C3C4E', '#5C5C73'],
      ['#121212', '#1F1F24', '#30303A', '#4B4B5A', '#74748C'],
      ['#0D1117', '#161B22', '#21262D', '#30363D', '#484F58'],
      ['#100E17', '#1C1826', '#2A2438', '#3D3450', '#574A73'],
      ['#0B0F14', '#141C24', '#1F2B38', '#2E4152', '#44607A'],
      ['#141013', '#231B22', '#342835', '#493A4C', '#66546B'],
      ['#0E1412', '#1A2422', '#26332F', '#36453F', '#4C5F55'],
      ['#15100E', '#251C18', '#372822', '#4B372E', '#63493C'],
      ['#0C0C14', '#171724', '#232338', '#32324F', '#464670'],
      ['#101418', '#1A2026', '#262F38', '#36434F', '#4A5B6B'],
      ['#130F0F', '#221B1B', '#332828', '#473838', '#5E4A4A'],
    ],
  },
  {
    id: 'neon',
    label: 'Neon',
    hint: 'Magenta e ciano al massimo della saturazione su nero profondo',
    // magenta e ciano prima di tutto, saturazione al massimo su un nero profondo
    hueArcs: [
      [290, 55, 3],
      [160, 40, 3],
      [70, 50, 2],
      [255, 35, 2],
      [45, 25, 1.5],
      [345, 30, 1.5],
    ],
    satRange: [0.85, 1.0],
    tonalProfiles: [
      [0.03, 0.72],
      [0.02, 0.8],
      [0.05, 0.65],
    ],
    harmonies: [H_COMPLEMENTARE, H_TRIADICA, H_SPLIT],
    curatedShare: 0.35,
    curated: [
      ['#252A34', '#08D9D6', '#FF2E63', '#EAEAEA'],
      ['#08000F', '#2B0B3F', '#FF00A0', '#00F0FF', '#F5F5FF'],
      ['#0A0014', '#1B0033', '#7B00FF', '#FF00C8', '#00FFD5'],
      ['#000000', '#12002E', '#5B00FF', '#FF006E', '#FFEE00'],
      ['#050014', '#240046', '#A100FF', '#FF2079', '#3DFFDC'],
      ['#0B0014', '#30004F', '#E100FF', '#00E5FF', '#CFFF04'],
      ['#000308', '#002B36', '#00FFB3', '#39FF14', '#F0FF60'],
      ['#0F0018', '#3A0068', '#784BA0', '#FF3CAC', '#2B86C5'],
      ['#010012', '#1A0040', '#6C00FF', '#FF0090', '#FFD000'],
      ['#000000', '#1A001F', '#FF1493', '#00FFFF', '#FFFF00'],
      ['#06000D', '#250041', '#8A00E6', '#FF3EA5', '#5FFBF1'],
      ['#020008', '#190030', '#4D00CC', '#E600B8', '#00FFC8'],
      ['#0A0010', '#2E004D', '#FF00E6', '#00B3FF', '#EEFF00'],
      ['#000205', '#001F26', '#00FFC8', '#66FF00', '#E5FF33'],
    ],
  },
]

export function findPaletteCategory(id: PaletteCategoryId | undefined): PaletteCategory | null {
  if (!id || id === 'all') return null
  return PALETTE_CATEGORIES.find((c) => c.id === id) ?? null
}

/**
 * Voci del selettore di categoria, con "Tutte" davanti: è l'assenza di vincolo, cioè il
 * generatore libero su tutto il cerchio delle tinte.
 */
export const PALETTE_CATEGORY_OPTIONS: Array<{
  id: PaletteCategoryId
  label: string
  hint: string
}> = [
  {
    id: 'all',
    label: 'Tutte',
    hint: 'Nessun vincolo: tinte su tutto il cerchio, saturazione e luce libere',
  },
  ...PALETTE_CATEGORIES.map(({ id, label, hint }) => ({ id, label, hint })),
]
