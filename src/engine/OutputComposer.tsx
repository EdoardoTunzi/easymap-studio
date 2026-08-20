import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useRenderStore } from '../store/renderStore'
import { publishRenderStats } from './renderStats'
import { setMaxAnisotropy } from './textureQuality'

/**
 * Passaggio finale di composizione: la scena non va più direttamente sullo schermo, ma dentro un
 * buffer interno che poi viene ridotto e finito qui.
 *
 * Perché serve, in ordine di importanza:
 *
 * 1. **Supersampling.** Il MSAA del canvas lavora solo sui bordi della *geometria* — cioè i 4 lati
 *    del quad, che con un PNG scontornato sono per giunta trasparenti e quindi invisibili. Tutto
 *    ciò che si vede davvero (i contorni disegnati dal fragment shader, il bordo della sagoma
 *    ricavato dall'alpha) non ne beneficia in alcun modo. L'unico antialiasing che agisce lì è
 *    disegnare più grande e ridurre: si fa qui, con un filtro nostro.
 * 2. **Niente clipping.** Con buffer a mezza precisione float i blend Add/Screen possono superare
 *    1.0 e rientrare con una curva morbida, invece di appiattirsi su bianco piatto.
 * 3. **Dither.** Gli 8 bit finali sono pochi per i gradienti larghi degli shader generativi: al
 *    buio, su un proiettore, il banding è la cosa che più fa sembrare "povera" l'immagine.
 * 4. **Grana.** Un video ha dettaglio ad alta frequenza ovunque, uno shader no: un filo di grana
 *    riavvicina le due cose e nasconde quel che resta del banding.
 *
 * Niente MSAA sul buffer interno, di proposito: un framebuffer multisample non si può copiare con
 * `copyTexSubImage2D`, e la copia del backdrop (`backdrop.ts`, per i blend avanzati) avviene
 * proprio mentre quel buffer è legato. Visto che il MSAA qui non salverebbe comunque nessun bordo
 * visibile, l'antialiasing lo fa il supersampling.
 */

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform sampler2D uScene;
uniform vec2 uOutSize;      // pixel dello schermo su cui stiamo scrivendo
uniform float uMultiTap;    // 1 = riduzione a 4 campioni (buffer interno più grande dell'uscita)
uniform float uRolloff;     // quanto l'eccesso oltre il fondo scala vira verso il bianco
uniform float uDither;      // 1 = dithering attivo
uniform float uGrain;       // ampiezza della grana
uniform float uTime;
varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453123);
}

/**
 * Sfondamento morbido: quando un canale supera il fondo scala, l'eccesso viene versato sugli
 * altri canali invece di essere tagliato via.
 *
 * Il taglio secco conserva la luminosità ma **sposta la tinta**: un (1.6, 1.2, 0.3)
 * diventa un giallo pieno, quando l'occhio si aspetterebbe qualcosa che tende al bianco. Versare
 * l'eccesso porta lì con continuità.
 *
 * Fondamentale: sotto il fondo scala **non tocca niente**. Una curva di compressione classica
 * avrebbe schiacciato anche i valori già buoni — il bianco pieno usciva a 239 invece di 255, cioè
 * il 6% dei lumen del proiettore buttato via per salvare informazione in zone che sfondano. Su un
 * proiettore il fondo scala è luce che si paga, e non si regala a una curva.
 */
vec3 highlightSpill(vec3 c, float amount) {
  float peak = max(max(c.r, c.g), c.b);
  if (peak <= 1.0 || amount <= 0.0) return c;
  // saturazione morbida dell'eccesso: anche uno sfondamento enorme non produce un lampo secco
  float excess = 1.0 - exp(-(peak - 1.0));
  return mix(c, vec3(1.0), excess * amount);
}

void main() {
  vec3 color;
  if (uMultiTap > 0.5) {
    // box filter sull'area del pixel di uscita: quattro prelievi a un quarto di pixel dal centro.
    // Con il filtro bilineare del buffer coprono l'intera area anche quando il rapporto fra le
    // due risoluzioni non è intero (1.25x, 1.5x), dove un solo prelievo lascerebbe fuori dei texel.
    vec2 d = 0.25 / uOutSize;
    color = texture2D(uScene, vUv + vec2(-d.x, -d.y)).rgb;
    color += texture2D(uScene, vUv + vec2(d.x, -d.y)).rgb;
    color += texture2D(uScene, vUv + vec2(-d.x, d.y)).rgb;
    color += texture2D(uScene, vUv + vec2(d.x, d.y)).rgb;
    color *= 0.25;
  } else {
    color = texture2D(uScene, vUv).rgb;
  }

  color = max(color, vec3(0.0));
  color = highlightSpill(color, uRolloff);

  if (uGrain > 0.0) {
    // grana temporale: deve muoversi, altrimenti è sporco fisso sull'obiettivo invece che pellicola
    float n = hash(gl_FragCoord.xy + fract(uTime) * 137.0) - 0.5;
    color += n * uGrain;
  }

  if (uDither > 0.5) {
    // rumore FISSO nello spazio (nessun termine di tempo): distribuisce l'errore di quantizzazione
    // sugli 8 bit finali senza far brulicare le zone piatte, che è ciò che si nota di più al buio
    float n = hash(gl_FragCoord.xy) - 0.5;
    color += n / 255.0;
  }

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
`

/** Lato massimo del buffer interno, oltre il quale il supersampling viene ridotto. */
function maxBufferSide(gl: THREE.WebGLRenderer): number {
  return Math.min(gl.capabilities.maxTextureSize, 8192)
}

/**
 * Tetto di memoria video per il buffer interno.
 *
 * A mezza precisione float un pixel costa 8 byte, e i blend avanzati ne allocano un secondo grande
 * uguale per la copia del backdrop: il consumo reale è quindi il doppio di questo numero. Mezzo
 * giga complessivo è già molto da chiedere a una GPU integrata, e un'allocazione fallita non dà
 * un errore leggibile — dà uno schermo nero, che a metà set è il modo peggiore di scoprirlo.
 */
const MAX_BUFFER_BYTES = 256 * 1024 * 1024

/**
 * Fattore di supersampling realmente applicabile: quello chiesto, ridotto se il buffer sfonda il
 * lato massimo delle texture o il tetto di memoria. Viene pubblicato nelle statistiche, perché una
 * riduzione silenziosa farebbe credere di star proiettando a una qualità che non si ha.
 */
function usableSuperSample(gl: THREE.WebGLRenderer, requested: number, outW: number, outH: number): number {
  const bySide = maxBufferSide(gl) / Math.max(outW, outH)
  const bytesPerPixel = 8
  const byMemory = Math.sqrt(MAX_BUFFER_BYTES / (outW * outH * bytesPerPixel))
  return Math.max(1, Math.min(requested, bySide, byMemory))
}

export function OutputComposer({ role = 'output' }: { role?: 'control' | 'output' }) {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)

  // il supersampling è solo del proiettore: in anteprima costerebbe frame all'Output (stessa GPU)
  // senza aggiungere nulla di leggibile su un riquadro grande un quarto di schermo
  const superSample = useRenderStore((s) => (role === 'output' ? s.superSample : 1))
  const hdr = useRenderStore((s) => s.hdr)
  const rolloff = useRenderStore((s) => s.rolloff)
  const dither = useRenderStore((s) => s.dither)
  const grain = useRenderStore((s) => s.grain)

  // scena del passaggio finale: vive fuori dalla scena principale, altrimenti il quad a schermo
  // intero verrebbe disegnato anche dentro il buffer, sopra i layer
  const pass = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: null as THREE.Texture | null },
        uOutSize: { value: new THREE.Vector2(1, 1) },
        uMultiTap: { value: 0 },
        uRolloff: { value: 0 },
        uDither: { value: 1 },
        uGrain: { value: 0 },
        uTime: { value: 0 },
      },
    })
    const quadScene = new THREE.Scene()
    quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material))
    return { scene: quadScene, camera: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), material }
  }, [])

  useEffect(() => {
    return () => {
      pass.material.dispose()
      pass.scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose()
      })
    }
  }, [pass])

  // il valore massimo di anisotropia lo conosce solo il renderer: da qui raggiunge le texture
  // di contenuto già create (vedi textureQuality.ts)
  useEffect(() => {
    setMaxAnisotropy(gl.capabilities.getMaxAnisotropy())
  }, [gl])

  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null)

  // Buffer interno: dimensione dello schermo per il fattore di supersampling, con un tetto che
  // evita di chiedere alla GPU una texture che non può allocare.
  useEffect(() => {
    const outW = Math.max(1, Math.floor(size.width * dpr))
    const outH = Math.max(1, Math.floor(size.height * dpr))
    const scale = usableSuperSample(gl, superSample, outW, outH)
    const width = Math.max(1, Math.floor(outW * scale))
    const height = Math.max(1, Math.floor(outH * scale))

    const existing = targetRef.current
    const type = hdr ? THREE.HalfFloatType : THREE.UnsignedByteType
    if (existing && existing.width === width && existing.height === height && existing.texture.type === type) {
      return
    }
    existing?.dispose()
    const target = new THREE.WebGLRenderTarget(width, height, {
      type,
      format: THREE.RGBAFormat,
      // passthrough: nessuna conversione in scrittura né in lettura, il colore attraversa intatto
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      depthBuffer: false,
      stencilBuffer: false,
    })
    targetRef.current = target
  }, [gl, size.width, size.height, dpr, superSample, hdr])

  useEffect(() => {
    return () => {
      targetRef.current?.dispose()
      targetRef.current = null
    }
  }, [])

  // media mobile degli fps: un singolo delta è troppo rumoroso per essere letto a occhio
  const fpsRef = useRef(0)
  const lastStatsRef = useRef(0)

  // priority > 0: da qui in poi il ciclo di disegno è nostro, R3F non renderizza più da sé
  useFrame((state, delta) => {
    const target = targetRef.current
    if (!target) return

    const material = pass.material
    const u = material.uniforms
    u.uScene.value = target.texture
    u.uOutSize.value.set(target.width, target.height)
    // il box filter serve solo quando il buffer interno è più grande dell'uscita
    u.uMultiTap.value = target.width > Math.floor(size.width * dpr) ? 1 : 0
    u.uRolloff.value = rolloff
    u.uDither.value = dither ? 1 : 0
    u.uGrain.value = grain
    u.uTime.value = state.clock.elapsedTime

    state.gl.setRenderTarget(target)
    state.gl.render(scene, camera)
    state.gl.setRenderTarget(null)
    state.gl.render(pass.scene, pass.camera)

    if (delta > 0) {
      const instant = 1 / delta
      fpsRef.current = fpsRef.current === 0 ? instant : fpsRef.current * 0.9 + instant * 0.1
    }
    const now = state.clock.elapsedTime
    if (now - lastStatsRef.current > 0.5) {
      lastStatsRef.current = now
      const buffer = state.gl.getDrawingBufferSize(new THREE.Vector2())
      publishRenderStats({
        bufferWidth: buffer.x,
        bufferHeight: buffer.y,
        renderWidth: target.width,
        renderHeight: target.height,
        dpr,
        superSample,
        // letto dal bersaglio davvero allocato, non dal valore chiesto: è l'unico modo di
        // accorgersi che il tetto di memoria o quello delle texture è entrato in gioco
        superSampleEffective: buffer.x > 0 ? target.width / buffer.x : 1,
        hdr: target.texture.type === THREE.HalfFloatType,
        fps: Math.round(fpsRef.current),
        // "a tutto schermo" comprende sia il fullscreen vero sia una finestra che copre lo
        // schermo: quello che conta è se stiamo usando tutti i pixel del proiettore
        fullscreen:
          document.fullscreenElement != null ||
          (Math.abs(window.innerWidth - window.screen.width) < 4 &&
            Math.abs(window.innerHeight - window.screen.height) < 4),
        screenWidth: Math.round(window.screen.width * window.devicePixelRatio),
        screenHeight: Math.round(window.screen.height * window.devicePixelRatio),
      })
    }
  }, 1)

  return null
}
