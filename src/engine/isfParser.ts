export interface UniformControl {
  name: string
  min: number
  max: number
  default: number
}

export interface ColorControl {
  name: string
  default: [number, number, number]
}

export interface ParsedShader {
  name: string
  raw: string
  controls: UniformControl[]
  /** Uniform vec3 (tipicamente colori) con valore di default, senza slider. */
  colorControls: ColorControl[]
  vertexShader: string
  fragmentShader: string
}

const NAME_RE = /\/\/\s*NAME:\s*(.+)/
const UNIFORM_RE =
  /uniform\s+float\s+(\w+)\s*;\s*\/\/\s*@min\s+(-?[\d.]+)\s*@max\s+(-?[\d.]+)\s*@default\s+(-?[\d.]+)/g
// uniform vec3 con @default r,g,b (usato dagli shader MAPSHROOM per i colori)
const VEC3_RE =
  /uniform\s+vec3\s+(\w+)\s*;\s*\/\/[^\n]*@default\s+(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)/g

const VERTEX_SHADER = `
varying vec2 vUv;
varying vec2 vPos;
void main() {
  vUv = uv;
  // posizione base (pre-transform, spazio dei corner): usata dalle maschere per forma,
  // così seguono il warp del corner-pin del layer.
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const MAX_MASKS = 8

function buildFragmentShader(raw: string): string {
  return `
precision highp float;
uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;
uniform float uScale;
uniform float uLumaKey;
uniform float uOpacity;
uniform vec3 uPalette[5];
uniform float uPaletteCount;
uniform float uPaletteAmount;
uniform float uPaletteOn;
// --- Maschere per-layer ---
uniform float uMaskCount;            // numero di forme attive (0 = nessuna)
uniform vec2 uMaskCenter[8];         // centro forma (spazio corner)
uniform vec2 uMaskHalf[8];           // semi-dimensioni (spazio corner)
uniform float uMaskRot[8];           // rotazione (rad)
uniform float uMaskFeather[8];       // sfumatura 0..1 (frazione della semi-dimensione minore)
uniform float uMaskType[8];          // 0 = rettangolo, 1 = ellisse
uniform float uMaskInvert[8];        // 1 = ritaglia fuori invece che dentro
uniform sampler2D uMaskTex;          // maschera da immagine (stencil)
uniform float uMaskTexOn;            // 1 = usa la maschera-immagine
varying vec2 vUv;
varying vec2 vPos;

// Fattore di visibilità dalle maschere del layer (1 = pieno, 0 = nascosto).
float easyvj_maskRegion() {
  float region = 1.0;
  if (uMaskCount > 0.5) {
    float acc = 0.0;
    for (int i = 0; i < 8; i++) {
      if (float(i) > uMaskCount - 0.5) break;
      vec2 d0 = vPos - uMaskCenter[i];
      float c = cos(-uMaskRot[i]);
      float s = sin(-uMaskRot[i]);
      vec2 q = vec2(c * d0.x - s * d0.y, s * d0.x + c * d0.y);
      vec2 h = max(uMaskHalf[i], vec2(1e-4));
      float fw = max(uMaskFeather[i] * min(h.x, h.y), 1e-4);
      float a;
      if (uMaskType[i] < 0.5) {
        vec2 dd = abs(q) - h;
        float ax = 1.0 - smoothstep(-fw, 0.0, dd.x);
        float ay = 1.0 - smoothstep(-fw, 0.0, dd.y);
        a = ax * ay;
      } else {
        float r = length(q / h);
        float fwr = fw / min(h.x, h.y);
        a = 1.0 - smoothstep(1.0 - fwr, 1.0, r);
      }
      if (uMaskInvert[i] > 0.5) a = 1.0 - a;
      acc = max(acc, a);
    }
    region = acc;
  }
  if (uMaskTexOn > 0.5) {
    vec4 mt = texture2D(uMaskTex, vUv);
    region *= dot(mt.rgb, vec3(0.299, 0.587, 0.114)) * mt.a;
  }
  return clamp(region, 0.0, 1.0);
}

${raw}

// Gradient map globale: mappa una scala 0..1 (luminanza dell'effetto) sulla palette scelta.
vec3 easyvj_gradient(float t) {
  t = clamp(t, 0.0, 1.0);
  float pos = t * (uPaletteCount - 1.0);
  vec3 col = uPalette[0];
  for (int i = 1; i < 5; i++) {
    if (float(i) <= uPaletteCount - 0.5) {
      float f = clamp(pos - float(i - 1), 0.0, 1.0);
      col = mix(col, uPalette[i], f);
    }
  }
  return col;
}

void main() {
  // La maschera usa SEMPRE la uv originale: la forma dell'immagine non cambia mai.
  vec4 src = texture2D(uTexture, vUv);
  float mask = src.a;
  // Luma key: se attivo (uLumaKey > 0) tratta come trasparenti le zone scure dell'immagine.
  // Serve per gli asset con sfondo NERO opaco (senza canale alpha trasparente).
  if (uLumaKey > 0.0) {
    float luma = dot(src.rgb, vec3(0.299, 0.587, 0.114));
    mask *= smoothstep(0.0, uLumaKey, luma);
  }
  if (mask <= 0.0) {
    // fuori dai bordi dell'immagine: pixel completamente trasparente, niente effetto
    gl_FragColor = vec4(0.0);
    return;
  }
  // La uv dell'effetto è scalata attorno al centro dal controllo Size globale (uScale):
  // uScale > 1 = pattern più grande, uScale < 1 = pattern più piccolo/ripetuto.
  vec2 fxUv = (vUv - 0.5) / uScale + 0.5;
  vec4 color = processColor(uTexture, fxUv, uTime, uResolution);
  // Ricolora l'effetto con la palette scelta (gradient map per luminanza), valido per ogni shader.
  if (uPaletteOn > 0.5) {
    float t = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    vec3 mapped = easyvj_gradient(t);
    color.rgb = mix(color.rgb, mapped, uPaletteAmount);
  }
  // Output premoltiplicato: rgb già moltiplicati per l'alpha finale. Necessario perché il
  // compositing multi-layer usa CustomBlending (One / OneMinusSrcAlpha, ecc.): così i blend
  // mode (add/screen/multiply) e l'opacità del layer si comportano correttamente e le zone
  // mascherate (alpha 0) non inquinano i layer sottostanti.
  // La region delle maschere per-layer restringe ulteriormente dove il layer è visibile.
  float outA = color.a * mask * easyvj_maskRegion() * uOpacity;
  gl_FragColor = vec4(color.rgb * outA, outA);
}
`
}

/** Estrae nome shader e controlli (@min/@max/@default) da una sorgente GLSL in stile ISF. */
export function parseShader(raw: string): ParsedShader {
  const nameMatch = raw.match(NAME_RE)
  const name = nameMatch ? nameMatch[1].trim() : 'Untitled Shader'

  const controls: UniformControl[] = []
  for (const match of raw.matchAll(UNIFORM_RE)) {
    const [, uniformName, min, max, def] = match
    controls.push({
      name: uniformName,
      min: Number(min),
      max: Number(max),
      default: Number(def),
    })
  }

  const colorControls: ColorControl[] = []
  for (const match of raw.matchAll(VEC3_RE)) {
    const [, uniformName, r, g, b] = match
    colorControls.push({
      name: uniformName,
      default: [Number(r), Number(g), Number(b)],
    })
  }

  return {
    name,
    raw,
    controls,
    colorControls,
    vertexShader: VERTEX_SHADER,
    fragmentShader: buildFragmentShader(raw),
  }
}
