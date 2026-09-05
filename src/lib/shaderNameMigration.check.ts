/**
 * Self-check del recupero dei nomi shader rinominati. Nessun framework:
 *   node --experimental-strip-types src/lib/shaderNameMigration.check.ts
 *
 * Il caso che conta davvero è l'ultimo: i cinque shader il cui nome VERO comincia con una vecchia
 * categoria. Se la regola li riscrivesse, il fix romperebbe i progetti che oggi funzionano.
 */
import assert from 'node:assert/strict'
import { migrateLayerShaderNames, migrateShaderName } from './shaderNameMigration.ts'

/** Libreria finta: i nomi attuali che servono ai casi qui sotto. */
const KNOWN = new Set([
  'Chrome Ripple',
  'Mandala',
  'Ridge Flow',
  'Oscilloscope',
  // i cinque che cominciano con una vecchia categoria pur essendo nomi attuali validi
  'Liquid Symmetry',
  'Halo Bloom',
  'Liquid Dunes',
  'Liquid Mercury',
  'Morph Ribbons',
])
const isKnown = (n: string) => KNOWN.has(n)

// --- il rename si inverte: via la prima parola quando è una categoria di allora ---
assert.equal(migrateShaderName('Psy Chrome Ripple', isKnown), 'Chrome Ripple')
assert.equal(migrateShaderName('Halo Mandala', isKnown), 'Mandala')
assert.equal(migrateShaderName('SD Ridge Flow', isKnown), 'Ridge Flow')
assert.equal(migrateShaderName('Audio Oscilloscope', isKnown), 'Oscilloscope')

// --- un nome già attuale non si tocca ---
assert.equal(migrateShaderName('Mandala', isKnown), 'Mandala')

// --- I CINQUE: nomi veri che cominciano con una vecchia categoria. Vanno lasciati stare. ---
for (const name of ['Liquid Symmetry', 'Halo Bloom', 'Liquid Dunes', 'Liquid Mercury', 'Morph Ribbons']) {
  assert.equal(migrateShaderName(name, isKnown), name, `${name} non deve essere accorciato`)
}

// --- si accetta solo se l'accorciato esiste: uno shader cancellato non diventa un altro shader ---
assert.equal(migrateShaderName('Psy Effetto Sparito', isKnown), 'Psy Effetto Sparito')
assert.equal(migrateShaderName('Qualcosa Mandala', isKnown), 'Qualcosa Mandala', 'prefisso non fra le categorie')
assert.equal(migrateShaderName('Mandala!', isKnown), 'Mandala!', 'nome di una parola sola')
assert.equal(migrateShaderName('', isKnown), '')

// --- i parametri seguono lo shader: le chiavi si spostano, i valori non si perdono ---
{
  const layer = {
    shaderName: 'Psy Chrome Ripple',
    params: { 'Psy Chrome Ripple': { speed: 3 }, Mandala: { petals: 8 } },
    colorParams: { 'Psy Chrome Ripple': { tint: [1, 0, 0] as [number, number, number] } },
  }
  const out = migrateLayerShaderNames(layer, isKnown)
  assert.equal(out.shaderName, 'Chrome Ripple')
  assert.deepEqual(out.params['Chrome Ripple'], { speed: 3 }, 'i parametri regolati vanno persi')
  assert.deepEqual(out.params.Mandala, { petals: 8 }, 'gli altri shader non vanno toccati')
  assert.deepEqual(out.colorParams['Chrome Ripple'], { tint: [1, 0, 0] })
  assert.ok(!('Psy Chrome Ripple' in out.params), 'la chiave vecchia deve sparire')
}

// --- chiave vecchia e nuova insieme: vince la nuova, che è quella regolata dopo il rename ---
{
  const layer = {
    shaderName: 'Psy Chrome Ripple',
    params: { 'Psy Chrome Ripple': { speed: 1 }, 'Chrome Ripple': { speed: 99 } },
  }
  const out = migrateLayerShaderNames(layer, isKnown)
  assert.deepEqual(out.params['Chrome Ripple'], { speed: 99 }, 'la chiave già aggiornata deve vincere')
}

// --- un layer già a posto non viene alterato ---
{
  const layer = { shaderName: 'Mandala', params: { Mandala: { petals: 3 } } }
  const out = migrateLayerShaderNames(layer, isKnown)
  assert.equal(out.shaderName, 'Mandala')
  assert.deepEqual(out.params, { Mandala: { petals: 3 } })
}

console.log('shaderNameMigration.check: tutto ok')
