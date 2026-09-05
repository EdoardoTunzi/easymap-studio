/**
 * Recupero dei riferimenti agli shader rinominati.
 *
 * ## Il danno
 *
 * Progetti, preset e clip di playlist referenziano lo shader per **nome** (`layer.shaderName`,
 * `EffectPreset.shaderName`, `PlaylistClip.shaderName`) e indicizzano i parametri messi a punto
 * con quello stesso nome (`layer.params[shaderName]`). Quando la libreria ha perso il prefisso di
 * categoria ripetuto nei `// NAME:` — "Psy Chrome Ripple" -> "Chrome Ripple", 90 shader su 123 —
 * tutti quei riferimenti sono rimasti a puntare a nomi che non esistevano più.
 *
 * Il risultato non era un effetto sbagliato ma il **vuoto**: `ShaderPlane` non disegna nulla se non
 * trova lo shader, quindi il layer spariva del tutto, asset compreso. I preset caricati o messi in
 * playlist non mostravano niente per la stessa ragione.
 *
 * ## Il recupero
 *
 * Il rename ha seguito una regola sola — via la prima parola, se è una delle categorie di allora —
 * quindi non serve una tabella di 90 righe: basta invertirla. Due precauzioni la rendono sicura:
 *
 * - **Prima si prova il nome così com'è.** Cinque shader si chiamano legittimamente "Liquid
 *   Symmetry", "Halo Bloom", "Liquid Dunes", "Liquid Mercury", "Morph Ribbons": togliere il
 *   prefisso a loro li romperebbe. Cercandoli per primi non vengono mai riscritti.
 * - **Si accetta solo se il nome accorciato esiste davvero.** Un nome sconosciuto resta com'è,
 *   così un progetto che riferisce uno shader cancellato non si trasforma in uno shader a caso.
 *
 * Verificato sul commit del rename: le 90 coppie sono tutte riprodotte da questa regola, nessun
 * nome nuovo collide con un altro e nessun nome di allora è stato riassegnato a uno shader diverso
 * (che sarebbe l'unico caso in cui il recupero potrebbe sbagliare bersaglio in silenzio).
 */

/** Categorie che comparivano come prima parola nei nomi prima del rename. */
const LEGACY_PREFIXES = ['Psy', 'Morph', 'SD', 'Liquid', 'Halo', 'Audio']

/** Il nome attuale dello shader a cui `name` si riferiva, o `name` stesso se non c'è nulla da fare. */
export function migrateShaderName(name: string, isKnown: (n: string) => boolean): string {
  if (!name || isKnown(name)) return name
  const space = name.indexOf(' ')
  if (space < 0) return name
  const head = name.slice(0, space)
  if (!LEGACY_PREFIXES.includes(head)) return name
  const stripped = name.slice(space + 1)
  return isKnown(stripped) ? stripped : name
}

/** Riscrive una mappa indicizzata per nome di shader, spostando i valori sulla chiave nuova. */
function migrateKeyedByShader<T>(
  byShader: Record<string, T> | undefined,
  isKnown: (n: string) => boolean,
): Record<string, T> {
  if (!byShader) return {}
  const out: Record<string, T> = {}
  for (const [shaderName, value] of Object.entries(byShader)) {
    const migrated = migrateShaderName(shaderName, isKnown)
    // se esistono sia la chiave vecchia sia quella nuova, vince la nuova: la vecchia è il residuo
    // di prima del rename, e sovrascriverla perderebbe i parametri regolati da allora in poi
    if (migrated === shaderName || !(migrated in byShader)) out[migrated] = value
  }
  return out
}

/**
 * Un layer con shader e parametri riportati ai nomi attuali.
 *
 * Il tipo di ritorno **non** e' `L`: le chiavi di `params`/`colorParams` sono proprio cio' che
 * questa funzione cambia, quindi promettere lo stesso tipo dell'ingresso sarebbe una bugia — e una
 * che il compilatore userebbe per bocciare l'accesso alla chiave nuova.
 */
export function migrateLayerShaderNames<
  L extends {
    shaderName: string
    params?: Record<string, Record<string, number>>
    colorParams?: Record<string, Record<string, [number, number, number]>>
  },
>(
  layer: L,
  isKnown: (n: string) => boolean,
): Omit<L, 'shaderName' | 'params' | 'colorParams'> & {
  shaderName: string
  params: Record<string, Record<string, number>>
  colorParams: Record<string, Record<string, [number, number, number]>>
} {
  return {
    ...layer,
    shaderName: migrateShaderName(layer.shaderName, isKnown),
    params: migrateKeyedByShader(layer.params, isKnown),
    colorParams: migrateKeyedByShader(layer.colorParams, isKnown),
  }
}
