/**
 * Self-check dell'export/import dei progetti. Nessun framework: si esegue con
 *   node --experimental-strip-types src/lib/projectFile.check.ts
 * e fallisce con un assert se un progetto non sopravvive al giro di andata e ritorno, o se un
 * file ostile/corrotto smette di essere respinto.
 *
 * Gira fuori dal browser perché `projectFile.ts` non tocca né DOM né IndexedDB: importa solo tipi
 * da `persistence.ts`, e i type import spariscono con lo strip.
 */
import assert from 'node:assert/strict'
import {
  PRESETS_FILE_FORMAT,
  PROJECT_FILE_FORMAT,
  PROJECT_FILE_VERSION,
  ProjectFileError,
  base64ToBlob,
  blobToBase64,
  detectFileKind,
  isValidCorners,
  parsePresetsFile,
  parseProjectFile,
  projectFileName,
  serializePresetsFile,
  serializeProjectFile,
  type ExportProgress,
} from './projectFile.ts'
import type { EffectPreset, StoredProject } from './persistence.ts'

/** L'esportazione produce un Blob: qui lo si rilegge come testo per poterlo reimportare. */
const asText = (blob: Blob) => blob.text()

// crypto.randomUUID serve a parseProjectFile ed esiste come globale da Node 19
assert.ok(typeof crypto?.randomUUID === 'function', 'serve Node 19+ per crypto.randomUUID')

const PNG_BYTES = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 250, 251, 252, 253, 254, 255])

function project(over: Partial<StoredProject> = {}): StoredProject {
  return {
    id: 'p1',
    name: 'Statua',
    updatedAt: 1,
    activeLayerId: 'l1',
    layers: [
      {
        id: 'l1',
        name: 'Layer 1',
        media: {
          name: 'statua.png',
          type: 'image',
          width: 800,
          height: 600,
          blob: new Blob([PNG_BYTES], { type: 'image/png' }),
        },
        maskImage: null,
      },
    ],
    ...over,
  } as StoredProject
}

// --- base64: i byte tornano identici, compresi quelli non ASCII ---
{
  const b64 = await blobToBase64(new Blob([PNG_BYTES], { type: 'image/png' }))
  const back = new Uint8Array(await base64ToBlob(b64, 'image/png').arrayBuffer())
  assert.deepEqual([...back], [...PNG_BYTES], 'i byte del media non sopravvivono al base64')
}

// --- un blob più grande di un chunk di String.fromCharCode (il caso che esplodeva lo stack) ---
{
  const big = new Uint8Array(0x8000 * 2 + 7).map((_, i) => i % 256)
  const back = new Uint8Array(
    await base64ToBlob(await blobToBase64(new Blob([big])), 'image/png').arrayBuffer(),
  )
  assert.equal(back.length, big.length, 'blob grande troncato')
  assert.deepEqual([...back.subarray(back.length - 3)], [...big.subarray(big.length - 3)])
}

// --- andata e ritorno: il progetto e il contenuto dell'asset si ritrovano dall'altra parte ---
{
  const imported = parseProjectFile(await asText(await serializeProjectFile(project())))
  assert.equal(imported.name, 'Statua')
  assert.equal(imported.layers.length, 1)
  const blob = imported.layers[0].media?.blob
  assert.ok(blob, "l'asset non è arrivato dall'altra parte")
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [...PNG_BYTES])
  assert.notEqual(imported.id, 'p1', "l'id deve essere nuovo: due import non devono sovrascriversi")
}

// --- la sorgente live non ha un file: si esporta il device, non un blob ---
{
  const live = project({
    layers: [
      { id: 'l1', name: 'Cam', media: { name: 'Webcam', type: 'camera', width: 2, height: 2, deviceId: 'dev-1' }, maskImage: null },
    ],
  } as Partial<StoredProject>)
  const imported = parseProjectFile(await asText(await serializeProjectFile(live)))
  assert.equal(imported.layers[0].media?.deviceId, 'dev-1')
  assert.equal(imported.layers[0].media?.blob, undefined)
}

// --- l'handle della cartella non finisce nel file (non è JSON e non varrebbe nulla altrove) ---
{
  const withFolder = project({
    assetPlaylists: {
      l1: { dir: { fake: true }, dirName: 'Clip', items: [], intervalSec: 5, shuffle: false, loop: true },
    },
  } as unknown as Partial<StoredProject>)
  const json = await asText(await serializeProjectFile(withFolder))
  assert.ok(!json.includes('"dir"'), "l'handle della cartella non deve finire nel file")
  const imported = parseProjectFile(json)
  assert.equal(imported.assetPlaylists?.l1.dirName, 'Clip', 'il nome della cartella deve restare')
}

// --- file rifiutati: ognuno con il suo messaggio, nessuno che passa ---
for (const [label, text] of [
  ['non è JSON', '{ questo non è json'],
  ['JSON ma non un oggetto', '"ciao"'],
  ['senza marcatore di formato', JSON.stringify({ project: { layers: [] } })],
  ['formato altrui', JSON.stringify({ format: 'altra-app/project', version: 1, project: {} })],
  ['versione futura', JSON.stringify({ format: PROJECT_FILE_FORMAT, version: PROJECT_FILE_VERSION + 1, project: {} })],
  ['senza layer', JSON.stringify({ format: PROJECT_FILE_FORMAT, version: 1, project: { layers: [] } })],
  ['layer non validi', JSON.stringify({ format: PROJECT_FILE_FORMAT, version: 1, project: { layers: [{ nope: 1 }] } })],
] as const) {
  assert.throws(() => parseProjectFile(text), ProjectFileError, `doveva rifiutare: ${label}`)
}

// --- un media con MIME non consentito diventa un layer vuoto, non un blob URL arbitrario ---
{
  const hostile = JSON.stringify({
    format: PROJECT_FILE_FORMAT,
    version: 1,
    project: {
      id: 'x',
      name: 'x',
      updatedAt: 0,
      activeLayerId: 'l1',
      layers: [{ id: 'l1', media: { name: 'x', type: 'image', width: 1, height: 1, data: 'AAA=', mime: 'text/html' }, maskImage: null }],
    },
  })
  assert.equal(parseProjectFile(hostile).layers[0].media, null, 'un MIME non consentito deve essere scartato')
}

// --- activeLayerId che punta a un layer inesistente ricade sul primo, invece di lasciare la scena senza layer attivo ---
{
  const orphan = parseProjectFile(await asText(await serializeProjectFile(project({ activeLayerId: 'sparito' }))))
  assert.equal(orphan.activeLayerId, 'l1')
}

// --- nome del file: niente caratteri che un filesystem rifiuta, e un ripiego se il nome è vuoto ---
assert.equal(projectFileName('Live 3/4: "Duomo"'), 'Live 3-4- -Duomo-.easymap.json')
assert.equal(projectFileName('   '), 'progetto.easymap.json')
assert.equal(projectFileName('Set', 'easymap-preset'), 'Set.easymap-preset.json')

// --- asset grande: i pezzi base64 si ricuciono dentro il Blob senza perdere né duplicare byte ---
// È il caso che faceva crashare la scheda, ed è anche quello in cui un errore di ricucitura
// passerebbe inosservato: la taglia non è multipla del blocco, così l'ultimo è parziale.
{
  const big = new Uint8Array(32766 * 7 + 1234).map((_, i) => (i * 31) % 256)
  const heavy = project({
    layers: [
      { id: 'l1', name: 'L', media: { name: 'clip.png', type: 'image', width: 1, height: 1, blob: new Blob([big], { type: 'image/png' }) }, maskImage: null },
    ],
  } as unknown as Partial<StoredProject>)
  const imported = parseProjectFile(await asText(await serializeProjectFile(heavy)))
  const back = new Uint8Array(await imported.layers[0].media!.blob!.arrayBuffer())
  assert.equal(back.length, big.length, 'asset grande troncato nella ricucitura dei pezzi')
  assert.ok(back.every((b, i) => b === big[i]), 'byte alterati nella ricucitura dei pezzi')
}

// --- avanzamento: monotòno, mai oltre il totale, e chiude sulla fase di scrittura ---
{
  const seen: ExportProgress[] = []
  const twoAssets = project({
    layers: [
      { id: 'l1', name: 'A', media: { name: 'a', type: 'image', width: 1, height: 1, blob: new Blob([new Uint8Array(32766 * 60)], { type: 'image/png' }) }, maskImage: null },
      { id: 'l2', name: 'B', media: { name: 'b', type: 'image', width: 1, height: 1, blob: new Blob([new Uint8Array(32766 * 60)], { type: 'image/png' }) }, maskImage: null },
    ],
  } as unknown as Partial<StoredProject>)
  await serializeProjectFile(twoAssets, (p) => seen.push({ ...p }))
  assert.ok(seen.length > 2, 'nessun avanzamento riportato durante la conversione')
  assert.equal(seen.at(-1)!.phase, 'write', "l'ultimo avanzamento deve essere la scrittura del file")
  assert.equal(seen.at(-1)!.done, seen.at(-1)!.total, 'la barra deve chiudere al 100%')
  for (let i = 1; i < seen.length; i++) {
    assert.ok(seen[i].done >= seen[i - 1].done, `avanzamento che torna indietro a ${i}`)
    assert.ok(seen[i].done <= seen[i].total, `avanzamento oltre il totale a ${i}`)
  }
  // il secondo asset deve contarsi SOPRA il primo, non ripartire da zero
  assert.ok(seen.some((p) => p.done > seen[1].total / 2), 'il totale non copre entrambi gli asset')
}

// --- preset: andata e ritorno, id rigenerati, formato riconosciuto ---
{
  const presets = [
    { id: 'a', name: 'Notte', updatedAt: 1, shaderName: 'Mandala', params: { speed: 2 }, size: 1, palette: { colors: [] } },
    { id: 'b', name: 'Alba', updatedAt: 2, shaderName: 'Ridge Flow', params: {}, size: 1, palette: { colors: [] } },
  ] as unknown as EffectPreset[]
  const text = await asText(serializePresetsFile(presets))
  assert.equal(detectFileKind(text), 'presets')
  const back = parsePresetsFile(text)
  assert.equal(back.length, 2)
  assert.equal(back[0].name, 'Notte')
  assert.equal(back[0].params.speed, 2)
  assert.notEqual(back[0].id, 'a', 'un preset importato non deve poter sovrascrivere quello con lo stesso id')
}

// --- i due formati non si confondono, e ognuno rifiuta l'altro con il proprio messaggio ---
{
  const projectText = await asText(await serializeProjectFile(project()))
  const presetsText = await asText(serializePresetsFile([{ id: 'a', name: 'X', updatedAt: 1, shaderName: 'S', params: {}, size: 1, palette: { colors: [] } } as unknown as EffectPreset]))
  assert.equal(detectFileKind(projectText), 'project')
  assert.equal(detectFileKind(presetsText), 'presets')
  assert.equal(detectFileKind('non json'), null)
  assert.throws(() => parsePresetsFile(projectText), ProjectFileError, 'un progetto non è una libreria di preset')
  assert.throws(() => parseProjectFile(presetsText), ProjectFileError, 'una libreria di preset non è un progetto')
}

// --- preset: file senza voci valide respinto, voci rotte scartate una a una ---
{
  const empty = JSON.stringify({ format: PRESETS_FILE_FORMAT, version: 1, presets: [] })
  assert.throws(() => parsePresetsFile(empty), ProjectFileError, 'un file senza preset va respinto')
  const mixed = JSON.stringify({
    format: PRESETS_FILE_FORMAT,
    version: 1,
    presets: [null, { name: 'ok', shaderName: 'S', params: {} }, { name: 'senza shader' }],
  })
  assert.equal(parsePresetsFile(mixed).length, 1, 'le voci rotte vanno scartate, non fatte passare')
}

// --- corner-pin: la forma VERA e' [{x,y} x4]. Un controllo scritto su una forma inventata
// dichiarava invalidi i corner di ogni progetto e schiacciava tutti i layer nel default. ---
{
  const real = [
    { x: -0.9, y: 0.5 },
    { x: 0.9, y: 0.5 },
    { x: -0.9, y: -0.5 },
    { x: 0.9, y: -0.5 },
  ]
  assert.ok(isValidCorners(real), 'i corner veri di un progetto devono essere accettati')
  assert.ok(isValidCorners(real.map((c) => ({ ...c, extra: 1 }))), 'campi in piu non invalidano')

  // e tutto cio che romperebbe quadAspect va rifiutato
  for (const [label, bad] of [
    ['null', null],
    ['non array', { a: 1 }],
    ['tre angoli', real.slice(0, 3)],
    ['cinque angoli', [...real, real[0]]],
    ['angolo null', [real[0], real[1], real[2], null]],
    ['x mancante', [real[0], real[1], real[2], { y: 1 }]],
    ['x non numerico', [real[0], real[1], real[2], { x: 'a', y: 1 }]],
    ['NaN', [real[0], real[1], real[2], { x: NaN, y: 1 }]],
    ['Infinity', [real[0], real[1], real[2], { x: Infinity, y: 1 }]],
    ['forma [x,y] (mai usata dall app)', [[1, 2], [3, 4], [5, 6], [7, 8]]],
  ] as const) {
    assert.equal(isValidCorners(bad), false, `doveva rifiutare: ${label}`)
  }
}

console.log('projectFile.check: tutto ok')
