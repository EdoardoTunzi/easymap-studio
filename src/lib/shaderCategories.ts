/**
 * Famiglie di effetti, per filtrare una libreria che ha ormai superato i cento shader.
 *
 * ## Due gruppi, prima delle famiglie
 *
 * La divisione che conta dal vivo non è estetica ma **funzionale**: ci sono effetti che leggono
 * l'immagine sorgente (la luminanza fa da rilievo, la pendenza guida le creste) e altri che la
 * ignorano del tutto. Entrambi restano ritagliati dentro la sagoma — il wrapper GLSL moltiplica
 * sempre l'alpha finale per quello della sorgente — ma solo i primi *seguono il soggetto*.
 * Scegliere un generativo quando si voleva qualcosa che si gonfiasse sulla statua è l'errore più
 * facile della libreria, e i pulsanti divisi in due blocchi servono a non commetterlo.
 *
 * ## La famiglia è dichiarata, non dedotta dal nome file
 *
 * Prima la categoria si ricavava dal prefisso del file (`psyStrobeGrid.glsl` → Psy). Non regge una
 * riclassificazione: spostare un effetto voleva dire rinominare il file o allungare una mappa di
 * eccezioni. Qui la mappa è la fonte di verità e i file restano dove sono.
 *
 * La chiave è il **basename del file**, non la riga `// NAME:`: quella è ciò con cui i progetti
 * salvati referenziano l'effetto (`layer.shaderName`, chiavi di `params`/`colorParams`) e cambiarla
 * romperebbe i progetti esistenti. Il basename invece non lo vede nessuno fuori da qui.
 */

export type ShaderCategoryId =
  | 'relief'
  | 'contour'
  | 'fluid'
  | 'halo'
  | 'morphogen'
  | 'fractal'
  | 'strobe'
  | 'tunnel'
  | 'plasma'
  | 'audio'
  | 'other'

/**
 * Come l'effetto si comporta rispetto all'asset: `object` lo legge e ci si modella sopra,
 * `background` lo ignora e riempie la sagoma con un pattern proprio.
 *
 * È una proprietà del **singolo shader**, non della famiglia: "Altri" contiene sia filtri
 * sull'immagine (O) sia figure disegnate da zero (S), e l'Oscilloscope audio è generativo.
 */
export type ShaderGroup = 'object' | 'background'

export interface ShaderGroupInfo {
  id: ShaderGroup
  /** Lettera mostrata accanto al nome nell'elenco: è la leggenda, deve stare in un carattere. */
  letter: string
  label: string
  hint: string
  /** Classe Tailwind del colore (token in `index.css`), condivisa da pulsante e lettera. */
  color: string
}

/** Ordine dei due pulsanti-leggenda, sopra ai filtri di famiglia. */
export const SHADER_GROUPS: ShaderGroupInfo[] = [
  {
    id: 'object',
    letter: 'O',
    label: "Sull'oggetto",
    hint: "Leggono l'immagine e ci si modellano sopra: seguono rilievi e bordi dell'asset",
    color: 'text-group-object',
  },
  {
    id: 'background',
    letter: 'S',
    label: 'Sullo sfondo',
    hint: "Ignorano il contenuto dell'immagine e riempiono la sagoma con un pattern proprio",
    color: 'text-group-background',
  },
]

export interface ShaderCategory {
  id: ShaderCategoryId | 'all'
  label: string
  /** Riga di aiuto sul pulsante: cosa accomuna gli effetti della famiglia. */
  hint: string
}

/** Ordine dei pulsanti: "Tutti", poi le famiglie, infine i casi a parte. */
export const SHADER_CATEGORIES: ShaderCategory[] = [
  { id: 'all', label: 'Tutti', hint: 'Tutta la libreria, senza filtro' },
  { id: 'relief', label: 'Rilievo', hint: "La luminanza dell'immagine fa da mappa di quota: il pattern si gonfia sul soggetto" },
  { id: 'contour', label: 'Contorni', hint: "Guidati dalla pendenza dell'immagine: creste e trame seguono le curve reali" },
  { id: 'fluid', label: 'Fluidi', hint: 'Superfici liquide, metalli fusi e onde che colano sul rilievo' },
  { id: 'halo', label: 'Aloni', hint: 'Simmetrie radiali e aloni attorno al soggetto' },
  { id: 'morphogen', label: 'Morphogen', hint: 'Reaction-diffusion con stato: crescono nel tempo e si possono riavviare' },
  { id: 'fractal', label: 'Frattali', hint: 'Frattali, mandala e geometrie sacre' },
  { id: 'strobe', label: 'Strobo', hint: 'Strobo, techno e glitch: griglie, laser, scanline, disturbi digitali' },
  { id: 'tunnel', label: 'Tunnel', hint: 'Tunnel, zoom infiniti e corse nello spazio' },
  { id: 'plasma', label: 'Plasma', hint: 'Plasma, nebbie e forme organiche in movimento' },
  { id: 'audio', label: 'Audio', hint: "Reattivi all'ingresso audio" },
  { id: 'other', label: 'Altri', hint: "Filtri sull'immagine e figure riconoscibili: casi singoli, fuori dalle famiglie" },
]

/**
 * Composizione delle famiglie, per **basename del file** (senza `.glsl`).
 *
 * Scritta per famiglia e non per file perché è così che si rilegge e si corregge: l'inversione in
 * mappa piatta avviene qui sotto una volta sola.
 *
 * `audio` non compare: è dinamica, la assegna `shaderCategoryOf` a chi legge l'ingresso audio,
 * qualunque famiglia gli sia stata attribuita qui.
 */
const MEMBERS: Record<Exclude<ShaderCategoryId, 'audio'>, string[]> = {
  relief: [
    '3DSurfaceMorphSpirals',
    'morphAuroraDepth',
    'morphBumpedSinusoidalWarp',
    'morphConcentricWaves',
    'morphCrystalFacets',
    'morphDepthScan',
    'morphElectricContours',
    'morphFractalDepth',
    'morphHexLattice',
    'morphInterferenceGrid',
    'morphLightningWeb',
    'morphMorphingAbstract',
    'morphPulseBeacon',
    'morphTorusField',
    'morphTunnelDepth',
    'morphVoronoiDepth',
  ],

  contour: [
    'sdContourMap',
    'sdEdgePulse',
    'sdHaloBloom',
    'sdMoltenDrape',
    'sdNebulaDrift',
    'sdPrismShards',
    'sdPulseSonar',
    'sdReliefLattice',
    'sdRidgeFlow',
    'sdShapeTunnel',
    'sdSilkWeave',
    'sdSparkVeins',
  ],

  fluid: [
    'liquidAuroraSpirals',
    'liquidChromeMelt',
    'liquidFractalFlow',
    'liquidMetaballSpirals',
    'liquidMorphRibbons',
    'liquidOrbitPetals',
    'liquidPlasmaVeins',
    'liquidSilkWaves',
    'liquidTwistTunnel',
    'liquidVortexBloom',
    'liquidZebraFlow',
    // fluidi nati con il prefisso morph: stessa tecnica, ma è il tema che li fa cercare
    'morphChromeFolds',
    'morphLiquidDunes',
    'morphMoltenRings',
    'morphNoiseAnimationLava',
    'morphRibbonAssault',
    'morphRibbonFlow',
    'metallic3dFluid',
  ],

  halo: [
    'haloConcentricPulse',
    'haloFractalBloom',
    'haloLiquidSymmetry',
    'haloMandala',
    'haloMirrorBloom',
    'haloPetalKaleido',
    'haloPrismaticSwirl',
    'haloRadialKaleido',
    'haloSpiralDrift',
    'haloTwinVortex',
    'symmetricalHaloSwirl',
    'symmetricalHaloSwirl-2',
    // radiali nati con il prefisso morph
    'morphDiscoSunVortex',
    'morphKaleidoDepth',
    'morphPetalBloom',
    'morphRadialShards',
    'morphSpiralGalaxy',
  ],

  morphogen: [
    'morphMorphogenGrowth',
    'morphMorphogenMitosis',
    'morphMorphogenMycelium',
    'morphMorphogenTuring',
  ],

  fractal: [
    'psyFractalFlower',
    'psyFractalMandala',
    'psyFractalPyramid',
    'psyHexagone',
    'psyKaleidoFractal',
    'psyMandelSlice',
    'psyPaletteFractLoop',
    'psySacredGeometry',
    'psySilexarGlobe',
    'psyStarleidoscope',
    'psyVortexFractal',
    'juliaDream',
    'kaleidoPrism',
    'kaliFractal',
  ],

  strobe: [
    'psyBassRings',
    'psyCircuitBoard',
    'psyDigitalRain',
    'psyEnergyWeb',
    'psyGlitchBlocks',
    'psyHexPulse',
    'psyLaserSweep',
    'psyNeonWireframe',
    'psyPulseBars',
    'psyStrobeGrid',
    'psyStrobeTunnel',
    'psyTechnoScanlines',
    'electricWeb',
    'neonRings',
    'warpGrid',
  ],

  tunnel: [
    'psyInfiniteZoom',
    'psyKaleidoCloudTunnel',
    'psyTrippySpiral',
    'psyTunnelRush',
    'psyWarpStars',
    'psyWireGridZoom',
    'hypnoTunnel',
    'starNest',
  ],

  plasma: [
    'psyAcidMelt',
    'psyAlienOrganism',
    'psyAuroraVeil',
    'psyBotanicalFireworks',
    'psyChromeRipple',
    'psyDnaHelix',
    'psyLiquidMercury',
    'psyNoiseAnimationElectric',
    'psyPlasmaStorm',
    'psySyntheticApertureSun',
    'meltNoise',
    'plasmaBloom',
    'voronoiCells',
    // non campiona affatto la sorgente: è generativo, il prefisso `liquid` era fuorviante
    'liquidMarble',
  ],

  other: [
    // trattano l'immagine COME immagine (deformano la uv della sorgente, dosano quanto si vede sotto)
    'vhs',
    'wireNetwork',
    // disegnano una figura riconoscibile invece di un pattern
    'eyesFeminine',
    'psyEye',
    // audio-reattivo: `shaderCategoryOf` lo dirotta comunque su 'audio', qui sta solo per completezza
    'audioOscilloscope',
  ],
}

/** Mappa piatta basename -> famiglia, costruita una volta sola all'avvio. */
const CATEGORY_OF_FILE = new Map<string, ShaderCategoryId>(
  Object.entries(MEMBERS).flatMap(([id, files]) =>
    files.map((file) => [file, id as ShaderCategoryId] as const),
  ),
)

/**
 * Famiglia di uno shader dal percorso del suo file. `usesAudio` vince su tutto: un effetto
 * audio-reattivo va cercato lì, qualunque famiglia gli sia stata assegnata.
 *
 * Uno shader nuovo non ancora inserito in `MEMBERS` finisce in "Altri" invece di sparire, e in
 * sviluppo lo segnala: è l'unico modo di accorgersi che la mappa è rimasta indietro.
 */
export function shaderCategoryOf(path: string, usesAudio: boolean): ShaderCategoryId {
  if (usesAudio) return 'audio'
  const file = path.split('/').pop()?.replace(/\.glsl$/, '') ?? ''
  const known = CATEGORY_OF_FILE.get(file)
  if (known) return known
  if (import.meta.env.DEV) {
    console.warn(`[shaderCategories] "${file}" non è in MEMBERS: finisce in "Altri".`)
  }
  return 'other'
}
