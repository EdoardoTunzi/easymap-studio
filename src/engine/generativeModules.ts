import type { RGB } from '../store/paletteStore'

/** Modalità con cui il contributo di un modulo si combina con l'accumulo dei moduli precedenti. */
export type ModuleBlendMode = 'normal' | 'add' | 'screen' | 'multiply'

export const MODULE_BLEND_MODES: { value: ModuleBlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'add', label: 'Add' },
  { value: 'screen', label: 'Screen' },
  { value: 'multiply', label: 'Multiply' },
]

export interface ModuleControlDef {
  /** Nome base dell'uniform (senza prefisso di istanza), es. "speed". */
  name: string
  label: string
  min: number
  max: number
  default: number
}

export interface ModuleColorControlDef {
  name: string
  label: string
  default: RGB
}

/**
 * Definizione di un modulo generativo: un blocco GLSL autonomo con un entry point
 * `vec3 <id>_<entryFn>(vec2 uv, float t)`. Gli uniform NON sono dichiarati qui: li emette
 * `composeModuleSource` dai `controls`/`colorControls`, così i valori correnti dell'istanza
 * finiscono nei `@default` e il parser ISF resta l'unica fonte di verità.
 */
export interface ModuleDef {
  id: string
  label: string
  description: string
  entryFn: string
  controls: ModuleControlDef[]
  colorControls: ModuleColorControlDef[]
  /** Corpo GLSL (helper + entry point). Ogni identificatore è prefissato con `id` per evitare
   *  collisioni tra istanze e tra moduli con helper omonimi (hash/noise/fbm). */
  body: (id: string) => string
}

function flowFieldBody(id: string): string {
  return `
float ${id}_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ${id}_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(${id}_hash(i), ${id}_hash(i + vec2(1.0, 0.0)), u.x),
             mix(${id}_hash(i + vec2(0.0, 1.0)), ${id}_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
vec2 ${id}_curl(vec2 p) {
  float e = 0.1;
  float n1 = ${id}_noise(p + vec2(0.0, e));
  float n2 = ${id}_noise(p - vec2(0.0, e));
  float n3 = ${id}_noise(p + vec2(e, 0.0));
  float n4 = ${id}_noise(p - vec2(e, 0.0));
  return vec2(n1 - n2, n4 - n3) / (2.0 * e);
}
vec3 ${id}_flowField(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * ${id}_scale;
  vec2 flow = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    flow += ${id}_curl(p + flow * ${id}_turbulence + t * ${id}_speed * 0.3 + float(i) * 7.3) * 0.6;
  }
  float lum = ${id}_noise(p * 1.5 + flow * 2.0 + t * ${id}_speed);
  return ${id}_tint * lum * ${id}_brightness;
}`
}

function fbmWarpBody(id: string): string {
  return `
float ${id}_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ${id}_noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(${id}_hash(i), ${id}_hash(i + vec2(1.0, 0.0)), u.x),
             mix(${id}_hash(i + vec2(0.0, 1.0)), ${id}_hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float ${id}_fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * ${id}_noise(p); p *= 2.0; a *= 0.5; }
  return v;
}
vec3 ${id}_fbmWarp(vec2 uv, float t) {
  vec2 p = uv * ${id}_scale;
  float ti = t * ${id}_speed;
  vec2 q = vec2(${id}_fbm(p + ti), ${id}_fbm(p + vec2(5.2, 1.3) - ti));
  vec2 r = vec2(${id}_fbm(p + ${id}_warp * q + vec2(1.7, 9.2)),
                ${id}_fbm(p + ${id}_warp * q + vec2(8.3, 2.8)));
  float f = ${id}_fbm(p + ${id}_warp * r);
  return mix(${id}_colorA, ${id}_colorB, clamp(f * ${id}_contrast, 0.0, 1.0));
}`
}

function worleyCellsBody(id: string): string {
  return `
vec2 ${id}_hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}
// distanza al punto più vicino (F1) e al secondo (F2): F2-F1 è ~0 sui bordi tra celle
vec2 ${id}_worleyF1F2(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 pt = ${id}_hash2(cell + neighbor);
      float d = length(neighbor + pt - f);
      if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) { f2 = d; }
    }
  }
  return vec2(f1, f2);
}
vec3 ${id}_worleyCells(vec2 uv, float t) {
  vec2 p = uv * ${id}_scale + vec2(t * ${id}_speed * 0.2, t * ${id}_speed * 0.15);
  vec2 d = ${id}_worleyF1F2(p);
  float edge = 1.0 - smoothstep(0.0, ${id}_edgeWidth, d.y - d.x);
  return ${id}_tint * edge * ${id}_glow;
}`
}

function waveInterferenceBody(id: string): string {
  return `
vec3 ${id}_waveInterference(vec2 uv, float t) {
  vec2 p = (uv - 0.5) * ${id}_frequency;
  float sum = 0.0;
  for (int i = 0; i < 3; i++) {
    vec2 c = vec2(sin(float(i) * 2.1 + 1.0), cos(float(i) * 1.7 + 1.0)) * 2.0;
    float d = length(p - c);
    sum += sin(d - t * ${id}_speed * 2.0 + float(i) * 2.09);
  }
  float v = max(sum / 3.0, 0.0);
  return ${id}_tint * pow(v, ${id}_sharpness);
}`
}

function pointGridBody(id: string): string {
  return `
float ${id}_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 ${id}_pointGrid(vec2 uv, float t) {
  vec2 p = uv * ${id}_density;
  vec2 cell = floor(p);
  vec2 f = fract(p) - 0.5;
  float rnd = ${id}_hash(cell);
  vec2 offs = (vec2(rnd, ${id}_hash(cell + 17.0)) - 0.5) * ${id}_jitter * 2.0;
  offs *= sin(t * ${id}_speed + rnd * 6.28318);
  float d = length(f - offs);
  return ${id}_tint * (1.0 - smoothstep(0.0, ${id}_dotSize, d));
}`
}

function colorCycleBody(id: string): string {
  return `
vec3 ${id}_colorCycle(vec2 uv, float t) {
  float hue = fract(t * ${id}_speed * 0.1 + uv.x * 0.15 + uv.y * 0.1);
  vec3 col = 0.5 + 0.5 * cos(6.28318 * (vec3(hue) + vec3(0.0, 0.33, 0.67)));
  col = mix(vec3(dot(col, vec3(0.333))), col, ${id}_saturation);
  return col * ${id}_brightness;
}`
}

/** Catalogo dei moduli generativi disponibili nell'editor "Moduli" del Generative Lab. */
export const GENERATIVE_MODULES: ModuleDef[] = [
  {
    id: 'flowField',
    label: 'Flow Field',
    entryFn: 'flowField',
    description: 'Curl noise che deriva colore e luminanza: il flusso continuo delle data sculpture.',
    controls: [
      { name: 'speed', label: 'Velocità', min: 0, max: 3, default: 0.6 },
      { name: 'scale', label: 'Scala', min: 0.5, max: 6, default: 2.5 },
      { name: 'turbulence', label: 'Turbolenza', min: 0, max: 2, default: 1 },
      { name: 'brightness', label: 'Luminosità', min: 0.2, max: 3, default: 1.2 },
    ],
    colorControls: [{ name: 'tint', label: 'Colore', default: [0.2, 0.6, 1] }],
    body: flowFieldBody,
  },
  {
    id: 'fbmWarp',
    label: 'FBM Domain Warp',
    entryFn: 'fbmWarp',
    description: 'Noise multi-ottava con warping del dominio: superfici organiche fluide.',
    controls: [
      { name: 'speed', label: 'Velocità', min: 0, max: 2, default: 0.4 },
      { name: 'scale', label: 'Scala', min: 1, max: 8, default: 3 },
      { name: 'warp', label: 'Warp', min: 0, max: 4, default: 2 },
      { name: 'contrast', label: 'Contrasto', min: 0.5, max: 3, default: 1.5 },
    ],
    colorControls: [
      { name: 'colorA', label: 'Colore A', default: [0.05, 0, 0.15] },
      { name: 'colorB', label: 'Colore B', default: [1, 0.4, 0.8] },
    ],
    body: fbmWarpBody,
  },
  {
    id: 'worleyCells',
    label: 'Worley Cells',
    entryFn: 'worleyCells',
    description: 'Pattern cellulare con bordi luminosi: struttura a celle organiche.',
    controls: [
      { name: 'scale', label: 'Scala', min: 2, max: 20, default: 8 },
      { name: 'speed', label: 'Velocità', min: 0, max: 2, default: 0.3 },
      { name: 'edgeWidth', label: 'Spessore bordo', min: 0.01, max: 0.5, default: 0.15 },
      { name: 'glow', label: 'Glow', min: 0.2, max: 3, default: 1.4 },
    ],
    colorControls: [{ name: 'tint', label: 'Colore', default: [1, 0.9, 0.3] }],
    body: worleyCellsBody,
  },
  {
    id: 'waveInterference',
    label: 'Wave Interference',
    entryFn: 'waveInterference',
    description: 'Onde concentriche che interferiscono tra loro.',
    controls: [
      { name: 'frequency', label: 'Frequenza', min: 2, max: 20, default: 8 },
      { name: 'speed', label: 'Velocità', min: 0, max: 3, default: 1 },
      { name: 'sharpness', label: 'Nitidezza', min: 0.5, max: 6, default: 2 },
    ],
    colorControls: [{ name: 'tint', label: 'Colore', default: [0.3, 0.8, 1] }],
    body: waveInterferenceBody,
  },
  {
    id: 'pointGrid',
    label: 'Point Grid',
    entryFn: 'pointGrid',
    description: 'Griglia di punti distorta nel tempo: approssima una nuvola di dati.',
    controls: [
      { name: 'density', label: 'Densità', min: 4, max: 40, default: 14 },
      { name: 'jitter', label: 'Jitter', min: 0, max: 0.5, default: 0.25 },
      { name: 'speed', label: 'Velocità', min: 0, max: 3, default: 0.8 },
      { name: 'dotSize', label: 'Dimensione punto', min: 0.02, max: 0.4, default: 0.12 },
    ],
    colorControls: [{ name: 'tint', label: 'Colore', default: [1, 1, 1] }],
    body: pointGridBody,
  },
  {
    id: 'colorCycle',
    label: 'Color Cycle',
    entryFn: 'colorCycle',
    description: 'Rotazione di tinta nel tempo: modulo modificatore da combinare con gli altri.',
    controls: [
      { name: 'speed', label: 'Velocità', min: 0, max: 2, default: 0.3 },
      { name: 'saturation', label: 'Saturazione', min: 0, max: 1.5, default: 1 },
      { name: 'brightness', label: 'Luminosità', min: 0.2, max: 2, default: 1 },
    ],
    colorControls: [],
    body: colorCycleBody,
  },
]

export function getModuleDef(moduleId: string): ModuleDef | undefined {
  return GENERATIVE_MODULES.find((m) => m.id === moduleId)
}

/** Un'istanza di modulo nello stack di un visual generativo. */
export interface ModuleInstance {
  /** Univoco nello stack: prefisso di tutti gli identificatori GLSL del modulo (es. "flowField1"). */
  instanceId: string
  moduleId: string
  /** Peso del contributo nel blend con i moduli precedenti (0..1). */
  weight: number
  blendMode: ModuleBlendMode
  /** Valori correnti dei controlli, chiave = nome base non prefissato (es. "speed"). */
  params: Record<string, number>
  colorParams: Record<string, RGB>
}

/**
 * Crea una nuova istanza di modulo con i valori di default del catalogo. Il blend di default è
 * `screen`: un modulo aggiunto si somma luminosamente a quelli sotto invece di coprirli, che è il
 * comportamento utile quando si stratificano generatori (il primo della pila ignora comunque il blend).
 * L'id è derivato dallo stack esistente, non da un contatore globale: così resta univoco anche
 * riaprendo un visual salvato in una sessione precedente.
 */
export function createModuleInstance(moduleId: string, existing: ModuleInstance[] = []): ModuleInstance {
  const def = getModuleDef(moduleId)
  const taken = new Set(existing.map((inst) => inst.instanceId))
  let n = 1
  while (taken.has(`${moduleId}${n}`)) n += 1
  return {
    instanceId: `${moduleId}${n}`,
    moduleId,
    weight: 1,
    blendMode: 'screen',
    params: Object.fromEntries((def?.controls ?? []).map((c) => [c.name, c.default])),
    colorParams: Object.fromEntries(
      (def?.colorControls ?? []).map((c) => [c.name, [...c.default] as RGB]),
    ),
  }
}

/** Formatta un numero con abbastanza decimali da restare un literal float GLSL valido. */
function glslFloat(value: number): string {
  const v = Number.isFinite(value) ? value : 0
  return v.toFixed(4)
}

function blendStatement(mode: ModuleBlendMode, weight: number): string {
  const w = glslFloat(weight)
  switch (mode) {
    case 'add':
      return `acc = acc + c * ${w};`
    case 'screen':
      return `acc = 1.0 - (1.0 - acc) * (1.0 - clamp(c * ${w}, 0.0, 1.0));`
    case 'multiply':
      return `acc = mix(acc, acc * c, ${w});`
    case 'normal':
    default:
      return `acc = mix(acc, c, ${w});`
  }
}

/**
 * Compone lo stack di moduli in un'unica sorgente GLSL nella convenzione ISF-like già usata dagli
 * shader statici (`// NAME:` + `@min @max @default`): il risultato passa da `parseShader()` senza
 * alcuna modifica al parser. I valori correnti dell'istanza vengono emessi come `@default`, così
 * lo shader risultante nasce già col look che si vede in anteprima.
 */
export function composeModuleSource(name: string, stack: ModuleInstance[]): string {
  const valid = stack.filter((inst) => getModuleDef(inst.moduleId))

  if (valid.length === 0) {
    return `// NAME: ${name.trim() || 'Visual generativo'}
vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  return vec4(0.0, 0.0, 0.0, 1.0);
}
`
  }

  const blocks = valid.map((inst) => {
    const def = getModuleDef(inst.moduleId)!
    const id = inst.instanceId
    const uniforms = [
      ...def.controls.map((c) => {
        const value = inst.params[c.name] ?? c.default
        return `uniform float ${id}_${c.name}; // @min ${glslFloat(c.min)} @max ${glslFloat(c.max)} @default ${glslFloat(value)}`
      }),
      ...def.colorControls.map((c) => {
        const [r, g, b] = inst.colorParams[c.name] ?? c.default
        return `uniform vec3 ${id}_${c.name}; // ${c.label} @default ${glslFloat(r)},${glslFloat(g)},${glslFloat(b)}`
      }),
    ]
    return [`// --- ${def.label} (${id}) ---`, ...uniforms, def.body(id)].join('\n')
  })

  const calls = valid.map((inst, i) => {
    const def = getModuleDef(inst.moduleId)!
    const call = `${inst.instanceId}_${def.entryFn}(uv, time)`
    // il primo modulo è la base: assegna sempre, altrimenti un blend come multiply su acc=0
    // restituirebbe nero qualunque cosa venga dopo
    const statement =
      i === 0 ? `acc = c * ${glslFloat(inst.weight)};` : blendStatement(inst.blendMode, inst.weight)
    return `  { vec3 c = ${call}; ${statement} }`
  })

  return `// NAME: ${name.trim() || 'Visual generativo'}
${blocks.join('\n\n')}

vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution) {
  vec3 acc = vec3(0.0);
${calls.join('\n')}
  return vec4(clamp(acc, 0.0, 1.0), 1.0);
}
`
}

/**
 * Riscrive i `@default` di una sorgente GLSL con valori casuali entro i rispettivi `@min`/`@max`.
 * Usato dal "Genera variante" in modalità codice, dove non esiste uno stack di moduli da mutare.
 */
export function randomizeSourceDefaults(source: string): string {
  return source.replace(
    /(@min\s+)(-?[\d.]+)(\s*@max\s+)(-?[\d.]+)(\s*@default\s+)(-?[\d.]+)/g,
    (_m, p1, min, p3, max, p5) => {
      const lo = Number(min)
      const hi = Number(max)
      const value = lo + Math.random() * (hi - lo)
      return `${p1}${min}${p3}${max}${p5}${glslFloat(value)}`
    },
  )
}
