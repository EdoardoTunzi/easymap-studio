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
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

function buildFragmentShader(raw: string): string {
  return `
precision highp float;
uniform sampler2D uTexture;
uniform float uTime;
uniform vec2 uResolution;
uniform float uScale;
uniform float uLumaKey;
uniform vec3 uPalette[5];
uniform float uPaletteCount;
uniform float uPaletteAmount;
uniform float uPaletteOn;
varying vec2 vUv;

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
  gl_FragColor = vec4(color.rgb, color.a * mask);
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
