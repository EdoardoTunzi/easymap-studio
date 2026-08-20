import type { ShaderCategoryId } from '../lib/shaderCategories'

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
  /**
   * Identità della *compilazione*, nuova a ogni parse: il nome non basta come chiave del
   * materiale, perché un visual generativo può essere rigenerato mantenendolo (nuovi moduli,
   * parametri diversi). Senza questo, React riusa il materiale e Three continua a girare il
   * programma GLSL compilato la prima volta, ignorando la sorgente aggiornata.
   */
  id: string
  name: string
  raw: string
  controls: UniformControl[]
  /** Uniform vec3 (tipicamente colori) con valore di default, senza slider. */
  colorControls: ColorControl[]
  /**
   * L'effetto legge l'ingresso audio (`easyvj_wave`/`easyvj_level`). Serve alla UI per proporre
   * l'attivazione del microfono solo dove ha senso, e alla finestra Output per aprire l'ingresso
   * da sé quando la scena ne contiene uno.
   */
  usesAudio: boolean
  /** Famiglia di appartenenza, per i filtri della libreria (vedi `shaderCategories.ts`). */
  category: ShaderCategoryId
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
// Peso prospettico del vertice (1/W dell'omografia del corner-pin, vedi engine/warpGeometry.ts).
// La camera è ortografica, quindi gl_Position.w vale 1 e la GPU interpolerebbe le uv linearmente
// in schermo: la texture si spezzerebbe lungo la diagonale del quad a ogni keystone. Portando
// (uv*k, k) e dividendo nel fragment si ottiene l'interpolazione proiettiva esatta.
attribute float aPersp;
varying vec3 vUvW;
varying vec2 vPos;
void main() {
  // 0 = attributo non fornito (default WebGL): succede alle miniature, che disegnano un quad
  // dritto a schermo intero e non hanno bisogno di correzione.
  float k = aPersp <= 0.0 ? 1.0 : aPersp;
  vUvW = vec3(uv * k, k);
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
uniform float uEdgeSharp;            // 0 = bordo della sagoma come sta nel file, 1 = massima nitidezza
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
// Rapporto larghezza/altezza del QUAD del layer (dai corner-pin, non del canvas): serve agli
// shader che disegnano forme riconoscibili (cerchi, occhi…) e non devono deformarsi col mapping.
uniform float uQuadAspect;
// --- Blend mode "avanzati" (quelli che il blending hardware non sa calcolare) ---
uniform sampler2D uBackdrop;         // copia di ciò che è già disegnato sotto questo layer
uniform vec2 uScreenSize;            // dimensioni del buffer di disegno, per campionarla
uniform float uBlendMode;            // 0 = ci pensa l'hardware; >0 = formula in easyvj_blend
// --- Ingresso audio (per gli shader audio-reattivi: si legge con easyvj_wave/easyvj_level) ---
uniform sampler2D uAudio;            // forma d'onda nel dominio del tempo, 256x1; 0.5 = silenzio
uniform float uAudioLevel;           // volume RMS 0..1
uniform float uAudioOn;              // 1 = ingresso audio attivo
// --- Controlli globali del layer (validi per QUALSIASI shader) ---
uniform float uFxSpeed;              // moltiplicatore del tempo
uniform float uFxRotation;           // rotazione del pattern (rad)
uniform vec2 uFxOffset;              // pan del pattern
uniform float uFxKaleido;            // segmenti radiali (0 = off)
uniform float uFxMirrorX;            // 1 = specchia orizzontalmente
uniform float uFxMirrorY;            // 1 = specchia verticalmente
uniform float uFxPixelate;           // 0 = off, altrimenti lato del blocco
uniform float uFxContrast;
uniform float uFxBrightness;
uniform float uFxSaturation;
uniform float uFxPosterize;          // 0 = off, altrimenti livelli per canale
uniform float uFxInvert;             // 0..1 miscela col negativo
// vUv arriva divisa per il peso prospettico (vedi VERTEX_SHADER): la macro fa la divisione al
// momento dell'uso, così i file .glsl continuano a scrivere vUv come se fosse un varying vec2.
varying vec3 vUvW;
#define vUv (vUvW.xy / vUvW.z)
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

// --- Formule di blend (separable blend modes del compositing standard) ---
// cb = colore di sotto (backdrop), cs = colore di questo layer. Tutte lavorano per canale.
vec3 easyvj_bMultiply(vec3 cb, vec3 cs) { return cb * cs; }
vec3 easyvj_bScreen(vec3 cb, vec3 cs) { return cb + cs - cb * cs; }

vec3 easyvj_bHardLight(vec3 cb, vec3 cs) {
  // sotto metà scurisce come Multiply, sopra schiarisce come Screen (con cs riscalato)
  return mix(easyvj_bMultiply(cb, 2.0 * cs), easyvj_bScreen(cb, 2.0 * cs - 1.0), step(0.5, cs));
}

vec3 easyvj_bSoftLight(vec3 cb, vec3 cs) {
  // la "D(cb)" della specifica: sotto un quarto una cubica, sopra la radice — serve a evitare
  // il gradino che si vedrebbe usando direttamente sqrt su tutto l'intervallo
  vec3 d = mix(((16.0 * cb - 12.0) * cb + 4.0) * cb, sqrt(cb), step(0.25, cb));
  vec3 lo = cb - (1.0 - 2.0 * cs) * cb * (1.0 - cb);
  vec3 hi = cb + (2.0 * cs - 1.0) * (d - cb);
  return mix(lo, hi, step(0.5, cs));
}

vec3 easyvj_bColorDodge(vec3 cb, vec3 cs) {
  return min(vec3(1.0), cb / max(1.0 - cs, 1e-4));
}

vec3 easyvj_bColorBurn(vec3 cb, vec3 cs) {
  return 1.0 - min(vec3(1.0), (1.0 - cb) / max(cs, 1e-4));
}

/** Formula corrispondente all'id passato in uBlendMode (vedi SHADER_BLEND in ShaderPlane). */
vec3 easyvj_blend(float mode, vec3 cb, vec3 cs) {
  if (mode < 1.5) return easyvj_bHardLight(cs, cb); // Overlay = Hard Light con gli operandi scambiati
  if (mode < 2.5) return easyvj_bSoftLight(cb, cs);
  if (mode < 3.5) return easyvj_bHardLight(cb, cs);
  if (mode < 4.5) return abs(cb - cs);                  // Difference
  if (mode < 5.5) return cb + cs - 2.0 * cb * cs;       // Exclusion
  if (mode < 6.5) return min(cb, cs);                   // Darken
  if (mode < 7.5) return max(cb, cs);                   // Lighten
  if (mode < 8.5) return easyvj_bColorBurn(cb, cs);
  return easyvj_bColorDodge(cb, cs);
}

// Trasformazioni della uv dell'effetto, comuni a tutti gli shader: agiscono PRIMA di
// processColor, quindi valgono anche per gli shader che non ne sanno nulla.
vec2 easyvj_fxUv(vec2 uv) {
  vec2 p = uv - 0.5;
  if (uFxMirrorX > 0.5) p.x = abs(p.x);
  if (uFxMirrorY > 0.5) p.y = abs(p.y);
  // caleidoscopio: ripiega l'angolo dentro un solo spicchio e lo replica in cerchio
  if (uFxKaleido > 1.5) {
    float a = atan(p.y, p.x);
    float r = length(p);
    float seg = 6.28318530718 / uFxKaleido;
    a = abs(mod(a + seg * 0.5, seg) - seg * 0.5);
    p = vec2(cos(a), sin(a)) * r;
  }
  if (abs(uFxRotation) > 0.0001) {
    float c = cos(uFxRotation);
    float s = sin(uFxRotation);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  }
  p += uFxOffset;
  vec2 result = p + 0.5;
  // quantizzazione a blocchi: campiona l'effetto su una griglia grossolana
  if (uFxPixelate > 0.5) {
    float cells = max(uFxPixelate, 1.0);
    result = (floor(result * cells) + 0.5) / cells;
  }
  return result;
}

/**
 * Campione della forma d'onda in [-1, 1] alla posizione x (0..1, ciclica).
 *
 * Senza ingresso audio attivo restituisce un'onda sintetica invece di una linea piatta: così un
 * effetto audio-reattivo resta leggibile in anteprima, nella miniatura della playlist e a
 * microfono spento, e si può regolarne i parametri prima di aprire l'ingresso.
 */
float easyvj_wave(float x, float t) {
  if (uAudioOn > 0.5) return texture2D(uAudio, vec2(fract(x), 0.5)).r * 2.0 - 1.0;
  return 0.50 * sin(x * 25.13 - t * 3.0)
       + 0.28 * sin(x * 9.42 + t * 1.7)
       + 0.16 * sin(x * 62.83 + t * 5.3);
}

/** Volume 0..1; a ingresso spento un respiro sintetico, per la stessa ragione di easyvj_wave. */
float easyvj_level(float t) {
  if (uAudioOn > 0.5) return uAudioLevel;
  return 0.32 + 0.22 * sin(t * 2.2) + 0.08 * sin(t * 5.7);
}

// Correzioni di colore comuni, applicate DOPO processColor e prima della palette.
vec3 easyvj_fxColor(vec3 col) {
  col *= uFxBrightness;
  col = (col - 0.5) * uFxContrast + 0.5;
  float luma = dot(col, vec3(0.299, 0.587, 0.114));
  col = mix(vec3(luma), col, uFxSaturation);
  if (uFxPosterize > 1.5) {
    float levels = max(uFxPosterize, 2.0);
    col = floor(col * levels) / (levels - 1.0);
  }
  col = mix(col, 1.0 - col, uFxInvert);
  return clamp(col, 0.0, 1.0);
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
  // Nitidezza del bordo: comprime la rampa dell'alpha attorno a metà scala, senza spostarla.
  // Serve perché il contorno del PNG viene ingrandito dal mapping (pochi pixel del file coprono
  // molti pixel del proiettore) e arriva sulla statua come un alone morbido invece che come un
  // taglio netto; la soglia a 0.5 tiene il bordo dov'era, così il mapping non si sposta.
  if (uEdgeSharp > 0.0) {
    mask = clamp((mask - 0.5) * (1.0 + uEdgeSharp * 11.0) + 0.5, 0.0, 1.0);
  }
  if (mask <= 0.0) {
    // fuori dai bordi dell'immagine: pixel completamente trasparente, niente effetto
    gl_FragColor = vec4(0.0);
    return;
  }
  // La uv dell'effetto è scalata attorno al centro dal controllo Size globale (uScale):
  // uScale > 1 = pattern più grande, uScale < 1 = pattern più piccolo/ripetuto.
  vec2 fxUv = (vUv - 0.5) / uScale + 0.5;
  // ...poi le trasformazioni globali del layer (mirror, kaleido, rotazione, pan, pixelate)
  fxUv = easyvj_fxUv(fxUv);
  // uFxSpeed scala il tempo dell'effetto: rallenta o accelera qualunque shader
  vec4 color = processColor(uTexture, fxUv, uTime * uFxSpeed, uResolution);
  color.rgb = easyvj_fxColor(color.rgb);
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
  if (uBlendMode > 0.5) {
    // Blend che il blending hardware non sa fare: si legge il backdrop copiato prima del disegno
    // e si scrive il risultato GIÀ composto (il materiale, in questo caso, sostituisce invece di
    // fondere). Dove il layer è trasparente si riscrive il backdrop tale e quale, quindi fuori
    // dalla sagoma non cambia nulla.
    vec2 screenUv = gl_FragCoord.xy / max(uScreenSize, vec2(1.0));
    vec3 backdrop = texture2D(uBackdrop, screenUv).rgb;
    vec3 blended = clamp(easyvj_blend(uBlendMode, backdrop, clamp(color.rgb, 0.0, 1.0)), 0.0, 1.0);
    gl_FragColor = vec4(mix(backdrop, blended, outA), 1.0);
    return;
  }
  gl_FragColor = vec4(color.rgb * outA, outA);
}
`
}

/**
 * Estrae nome shader e controlli (@min/@max/@default) da una sorgente GLSL in stile ISF.
 * `category` arriva da chi carica il file (il percorso non è visibile da qui).
 */
export function parseShader(raw: string, category: ShaderCategoryId = 'other'): ParsedShader {
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

  const usesAudio = /easyvj_wave|easyvj_level|uAudio/.test(raw)

  return {
    id: crypto.randomUUID(),
    name,
    raw,
    controls,
    colorControls,
    usesAudio,
    // gli effetti audio-reattivi hanno una famiglia propria, qualunque sia il file
    category: usesAudio ? 'audio' : category,
    vertexShader: VERTEX_SHADER,
    fragmentShader: buildFragmentShader(raw),
  }
}
