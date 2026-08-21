import * as THREE from 'three'
import type { SimulationProgram } from './isfParser'

/**
 * Effetti **con stato**: la coppia di render target in ping-pong su cui gira il passo di
 * simulazione dichiarato da un file `.glsl` dopo `//! SIMULATION`.
 *
 * Serve alla reaction-diffusion vera: ogni passo ha bisogno del risultato del passo precedente,
 * quindi non si puo' calcolare dentro il fragment shader del layer, che vede un pixel alla volta
 * e non ha memoria fra un frame e l'altro.
 *
 * Il dominio e' un **toro**: le texture usano RepeatWrapping, quindi il laplaciano ai bordi legge
 * il lato opposto e il pattern non ha mai una cucitura, comunque venga mappato sul quad.
 */

/** Semi disponibili nel wrapper (`uniform vec2 uSeeds[8]`). */
export const MAX_SEEDS = 8

/**
 * Precisione dello stato: float pieno quando la GPU lo sa filtrare, mezza precisione altrimenti.
 *
 * Non e' un dettaglio di qualita': a 16 bit, **vicino a 1.0 l'ulp vale circa 0.001**, ed e'
 * esattamente li' che vive il substrato non ancora consumato. Gli incrementi piu' piccoli di
 * quella soglia sparivano, la coda che alimenta il fronte non si formava e il regime effettivo
 * scivolava altrove: si chiedeva una crescita a rami e si otteneva un tappeto di macchie.
 */
function textureType(renderer: THREE.WebGLRenderer): THREE.TextureDataType {
  const canFilterFloat = renderer.extensions.has('OES_texture_float_linear')
  const canRenderFloat =
    renderer.capabilities.isWebGL2 || renderer.extensions.has('WEBGL_color_buffer_float')
  return canFilterFloat && canRenderFloat ? THREE.FloatType : THREE.HalfFloatType
}

export interface SimulationHandle {
  /** Stato corrente, da passare a `uSimState` del materiale di disegno. */
  readonly texture: THREE.Texture
  /** Uniform propri del passo (semi, fase, riavvio): aggiornati da chi lo fa girare. */
  readonly uniforms: Record<string, { value: unknown }>
  readonly texel: THREE.Vector2
  /** Esegue `steps` passi; se `init` scrive prima lo stato iniziale (semi puliti). */
  run(renderer: THREE.WebGLRenderer, steps: number, init: boolean): void
  dispose(): void
}

function createTarget(size: number, type: THREE.TextureDataType): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(size, size, {
    type,
    format: THREE.RGBAFormat,
    // nessuna conversione di spazio colore: qui dentro non ci sono colori ma concentrazioni
    colorSpace: THREE.LinearSRGBColorSpace,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  })
  return target
}

/**
 * `shared` sono gli oggetti uniform del materiale di disegno riusati **per riferimento** (i
 * controlli dell'effetto, il media, l'aspect del quad): aggiornarli una volta sola in
 * `EffectPass` basta per entrambi i programmi, e non c'e' modo che i due divergano.
 */
export function createSimulation(
  program: SimulationProgram,
  shared: Record<string, { value: unknown }>,
  renderer: THREE.WebGLRenderer,
): SimulationHandle {
  const size = program.size
  const type = textureType(renderer)
  let front = createTarget(size, type)
  let back = createTarget(size, type)

  const own: Record<string, { value: unknown }> = {
    uState: { value: front.texture },
    uTexel: { value: new THREE.Vector2(1 / size, 1 / size) },
    uInit: { value: 1 },
    uPhase: { value: 0 },
    uSeeds: { value: Array.from({ length: MAX_SEEDS }, () => new THREE.Vector2(0.5, 0.5)) },
    uSeedCount: { value: 1 },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: program.vertexShader,
    fragmentShader: program.fragmentShader,
    uniforms: { ...shared, ...own },
    depthTest: false,
    depthWrite: false,
  })

  const scene = new THREE.Scene()
  const geometry = new THREE.PlaneGeometry(2, 2)
  scene.add(new THREE.Mesh(geometry, material))
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const handle: SimulationHandle = {
    get texture() {
      return front.texture
    },
    uniforms: own,
    texel: own.uTexel.value as THREE.Vector2,

    run(renderer, steps, init) {
      if (steps <= 0 && !init) return
      // il target attivo va ripristinato: qui si gira PRIMA del passaggio di composizione, che
      // sta scrivendo nel proprio buffer interno (vedi OutputComposer)
      const previous = renderer.getRenderTarget()
      const total = init ? steps + 1 : steps
      for (let i = 0; i < total; i++) {
        material.uniforms.uInit.value = init && i === 0 ? 1 : 0
        material.uniforms.uState.value = front.texture
        renderer.setRenderTarget(back)
        renderer.render(scene, camera)
        const swap = front
        front = back
        back = swap
      }
      renderer.setRenderTarget(previous)
    },

    dispose() {
      front.dispose()
      back.dispose()
      geometry.dispose()
      material.dispose()
    },
  }
  return handle
}

/** Modi del ciclo di vita, nell'ordine dichiarato da `@options` nello shader. */
export const LIFECYCLE = { MATURE: 0, CYCLE: 1, MANUAL: 2 } as const

/**
 * Quanti passi eseguire in questo frame.
 *
 * Il conteggio e' agganciato al **tempo trascorso**, non ai frame: due finestre che girano a fps
 * diversi (l'anteprima e il proiettore, sulla stessa GPU) devono arrivare allo stesso numero di
 * passi, altrimenti mostrerebbero due stati diversi della stessa simulazione — e si allineerebbe
 * il mapping su un'immagine che il pubblico non vede.
 *
 * Il tetto per frame evita che una finestra rimasta indietro (scheda in background, che il
 * browser mette a 0 fps) provi a recuperare mille passi tutti insieme inchiodando la GPU: in quel
 * caso si accetta di restare indietro, perche' il pattern maturo e' comunque uno stato stabile.
 */
export function planSteps(elapsed: number, stepsPerSecond: number, done: number, maxPerFrame: number): number {
  const target = Math.floor(Math.max(elapsed, 0) * stepsPerSecond)
  return Math.max(0, Math.min(target - done, maxPerFrame))
}

/**
 * Posizioni dei semi sulla griglia di simulazione.
 *
 * Il primo sta dove l'utente lo mette; gli altri si dispongono attorno sull'angolo aureo, che li
 * tiene ben distribuiti per qualunque numero senza tabelle e senza allineamenti visibili.
 */
export function seedPositions(
  count: number,
  posX: number,
  posY: number,
  aspect: number,
  patternScale: number,
): Array<{ x: number; y: number }> {
  const scale = Math.max(patternScale, 0.01)
  const toSim = (dx: number, dy: number) => ({
    x: ((posX + dx) * aspect) / scale + 0.5,
    y: (posY + dy) / scale + 0.5,
  })
  const seeds = [toSim(0, 0)]
  for (let i = 1; i < count; i++) {
    const angle = i * 2.39996
    const radius = 0.18 + 0.06 * i
    seeds.push(toSim(Math.cos(angle) * radius, Math.sin(angle) * radius))
  }
  return seeds
}
