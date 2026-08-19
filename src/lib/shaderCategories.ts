/**
 * Famiglie di effetti, per filtrare una libreria che ha ormai superato i cento shader.
 *
 * La famiglia si deduce dal **nome del file** (`psyStrobeGrid.glsl` → Psy), non dal nome
 * visualizzato: il prefisso del file è la convenzione con cui la libreria è cresciuta ed è
 * l'unica cosa che resta stabile anche se un effetto viene rinominato.
 */

export type ShaderCategoryId = 'halo' | 'liquid' | 'morph' | 'psy' | 'sd' | 'audio' | 'other'

export interface ShaderCategory {
  id: ShaderCategoryId | 'all'
  label: string
  /** Riga di aiuto sul pulsante: cosa accomuna gli effetti della famiglia. */
  hint: string
}

/** Ordine dei pulsanti: prima "Tutti", poi le famiglie numerose, infine i casi singoli. */
export const SHADER_CATEGORIES: ShaderCategory[] = [
  { id: 'all', label: 'Tutti', hint: "Tutta la libreria, senza filtro" },
  { id: 'psy', label: 'Psy', hint: 'Psytrance e techno: strobo, tunnel, laser, griglie, frattali' },
  { id: 'morph', label: 'Morph', hint: "La luminanza dell'immagine fa da mappa di quota e deforma il pattern" },
  { id: 'halo', label: 'Halo', hint: 'Simmetrie radiali e aloni attorno al soggetto' },
  { id: 'liquid', label: 'Liquid', hint: 'Superfici fluide, metalli liquidi, onde' },
  { id: 'sd', label: 'SD', hint: "Guidati dalla pendenza dell'immagine: creste e trame seguono le curve reali" },
  { id: 'audio', label: 'Audio', hint: "Reattivi all'ingresso audio" },
  { id: 'other', label: 'Altri', hint: 'Effetti singoli, fuori dalle famiglie' },
]

/** Prefissi dei file che identificano una famiglia. */
const PREFIXES: { prefix: string; id: ShaderCategoryId }[] = [
  { prefix: 'halo', id: 'halo' },
  { prefix: 'liquid', id: 'liquid' },
  { prefix: 'morph', id: 'morph' },
  { prefix: 'psy', id: 'psy' },
  { prefix: 'sd', id: 'sd' },
]

/**
 * Effetti nati prima della convenzione sui prefissi, che appartengono comunque a una famiglia:
 * lasciarli in "Altri" li renderebbe introvabili proprio a chi cerca quella famiglia.
 */
const EXCEPTIONS: Record<string, ShaderCategoryId> = {
  symmetricalHaloSwirl: 'halo',
  'symmetricalHaloSwirl-2': 'halo',
  '3DSurfaceMorphSpirals': 'morph', // è il capostipite dei Morph, source-driven come loro
}

/**
 * Famiglia di uno shader dal percorso del suo file. `usesAudio` vince su tutto: un effetto
 * audio-reattivo va cercato lì, qualunque prefisso abbia il file.
 */
export function shaderCategoryOf(path: string, usesAudio: boolean): ShaderCategoryId {
  if (usesAudio) return 'audio'
  const file = path.split('/').pop()?.replace(/\.glsl$/, '') ?? ''
  const exception = EXCEPTIONS[file]
  if (exception) return exception
  return PREFIXES.find((p) => file.startsWith(p.prefix))?.id ?? 'other'
}
