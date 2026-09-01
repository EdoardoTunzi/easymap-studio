/**
 * Self-check di `nextAssetIndex`. Nessun framework: si esegue con
 *   node --experimental-strip-types src/lib/assetRotation.check.ts
 * e fallisce con un assert se l'avanzamento della playlist si rompe.
 */
import assert from 'node:assert/strict'
import { nextAssetIndex } from './assetRotation.ts'

// sequenziale
assert.equal(nextAssetIndex(0, 3, false, true), 1)
assert.equal(nextAssetIndex(1, 3, false, true), 2)
// wrap col loop attivo, stop senza
assert.equal(nextAssetIndex(2, 3, false, true), 0)
assert.equal(nextAssetIndex(2, 3, false, false), -1)

// liste degeneri
assert.equal(nextAssetIndex(0, 0, false, true), -1)
assert.equal(nextAssetIndex(0, 1, false, true), 0)
assert.equal(nextAssetIndex(0, 1, false, false), -1)

// shuffle: mai l'indice corrente, sempre dentro i limiti, e tutti raggiungibili
const seen = new Set<number>()
for (let i = 0; i < 500; i++) {
  const n = nextAssetIndex(2, 5, true, false)
  assert.ok(n >= 0 && n < 5, `shuffle fuori dai limiti: ${n}`)
  assert.notEqual(n, 2, 'shuffle ha ripetuto la clip corrente')
  seen.add(n)
}
assert.deepEqual([...seen].sort(), [0, 1, 3, 4])

// shuffle al primo giro (nessun indice corrente): può uscire anche lo 0
const first = new Set<number>()
for (let i = 0; i < 500; i++) first.add(nextAssetIndex(-1, 3, true, false))
assert.deepEqual([...first].sort(), [0, 1, 2])

console.log('assetRotation: ok')
