import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import type { ParsedShader } from './isfParser'
import {
  createSimulation,
  LIFECYCLE,
  MAX_SEEDS,
  planSteps,
  seedPositions,
  type SimulationHandle,
} from './simulation'

/**
 * Fa girare il passo di simulazione di un effetto con stato e consegna il risultato al materiale
 * di disegno (`uSimState`).
 *
 * I nomi dei controlli letti qui sono una **convenzione** fra il file .glsl e questo componente:
 * uno shader con stato che voglia essere pilotabile li dichiara con questi nomi, e chi non li
 * dichiara si prende i valori di ripiego. Non c'e' altro modo: gli uniform GLSL sono numeri senza
 * significato, e la scelta del seme o il riavvio del ciclo sono decisioni che vanno prese in TS,
 * prima di disegnare.
 */
const P = {
  speed: 'speed',
  seeds: 'seeds',
  posX: 'posX',
  posY: 'posY',
  scale: 'scale',
  lifecycle: 'lifecycle',
  cycleTime: 'cycleTime',
  restart: 'restart',
} as const

/**
 * Passi di simulazione al secondo a velocita' 1.
 *
 * Un passo di Gray-Scott muove pochissimo: per far crescere una colonia da un seme fino a
 * riempire il campo ne servono qualche migliaio. A poche decine di passi al secondo la crescita
 * durerebbe minuti — troppo per un live, dove deve leggersi in una ventina di secondi.
 */
const STEPS_PER_SECOND = 150

/**
 * Tetto di passi per frame. Recuperare un ritardo va bene, ma una finestra rimasta ferma a lungo
 * (scheda in background) non deve provare a rifare tutta la storia in un colpo solo: meglio
 * restare indietro, tanto il pattern maturo e' uno stato stabile su cui le due finestre
 * riconvergono da sole.
 */
const MAX_STEPS_PER_FRAME = 8

interface SimulationPassProps {
  shader: ParsedShader
  /**
   * Materiale di disegno del layer.
   *
   * Serve il materiale e non il dizionario di uniform da cui e' stato costruito: R3F, applicando
   * la prop, non lascia in giro lo stesso oggetto, e infatti tutto il resto dell'aggiornamento
   * per-frame passa da `materialRef.current.uniforms`. Scrivere altrove significa scrivere in un
   * dizionario che nessuno legge — lo stato non arriverebbe mai allo shader.
   */
  materialRef: React.RefObject<THREE.ShaderMaterial | null>
  /** Parametri correnti dell'effetto, riletti a ogni frame da chi disegna. */
  paramsRef: React.RefObject<Record<string, number>>
  /** Aspect del quad, per tenere tonde le celle sulla griglia quadrata. */
  aspectRef: React.RefObject<number>
}

export function SimulationPass({ shader, materialRef, paramsRef, aspectRef }: SimulationPassProps) {
  const program = shader.simulation
  // creata al primo frame utile: al montaggio il materiale non esiste ancora, e la simulazione
  // deve nascere agganciata al suo dizionario di uniform
  const simRef = useRef<{ handle: SimulationHandle; owner: object } | null>(null)
  useEffect(
    () => () => {
      simRef.current?.handle.dispose()
      simRef.current = null
    },
    [program],
  )

  const run = useRef({ done: 0, startedAt: Date.now(), lastRestart: Number.NaN, lastCycle: -1, init: true })

  useFrame((state) => {
    const mat = materialRef.current
    if (!program || !mat) return
    const uniforms = mat.uniforms as Record<string, { value: unknown }>
    // il materiale viene ricreato al cambio di shader o di blend mode: la simulazione va
    // riagganciata al nuovo dizionario, e riparte da capo
    if (simRef.current && simRef.current.owner !== uniforms) {
      simRef.current.handle.dispose()
      simRef.current = null
    }
    if (!simRef.current) {
      simRef.current = { handle: createSimulation(program, uniforms, state.gl), owner: uniforms }
      run.current = { done: 0, startedAt: Date.now(), lastRestart: Number.NaN, lastCycle: -1, init: true }
    }
    const sim = simRef.current.handle
    const params = paramsRef.current ?? {}
    const now = Date.now()
    const r = run.current

    const mode = Math.round(params[P.lifecycle] ?? LIFECYCLE.MATURE)
    const cycleTime = Math.max(params[P.cycleTime] ?? 20, 2)

    // Il riavvio manuale e' un interruttore che fa da pulsante: conta il CAMBIO di valore, non il
    // valore. Cosi' ogni click riavvia, e il gesto arriva anche all'Output, perche' i parametri
    // dell'effetto viaggiano gia' nel messaggio di stato.
    const restart = params[P.restart] ?? 0
    if (!Number.isNaN(r.lastRestart) && restart !== r.lastRestart) {
      r.init = true
      r.done = 0
      r.startedAt = now
    }
    r.lastRestart = restart

    let elapsed: number
    if (mode === LIFECYCLE.CYCLE) {
      // fase derivata dall'orologio di sistema: le due finestre calcolano lo stesso numero senza
      // doversi scambiare nulla, quindi il ciclo e' identico su anteprima e proiettore
      const cycleIndex = Math.floor(now / 1000 / cycleTime)
      if (cycleIndex !== r.lastCycle) {
        if (r.lastCycle !== -1) {
          r.init = true
          r.done = 0
        }
        r.lastCycle = cycleIndex
      }
      elapsed = (now / 1000) % cycleTime
    } else {
      elapsed = (now - r.startedAt) / 1000
    }

    // semi e fase, aggiornati prima dei passi
    const scale = params[P.scale] ?? 1
    const count = Math.max(1, Math.min(Math.round(params[P.seeds] ?? 1), MAX_SEEDS))
    const positions = seedPositions(
      count,
      params[P.posX] ?? 0,
      params[P.posY] ?? 0,
      aspectRef.current ?? 1,
      scale,
    )
    const seedUniform = sim.uniforms.uSeeds.value as THREE.Vector2[]
    for (let i = 0; i < count; i++) seedUniform[i].set(positions[i].x, positions[i].y)
    sim.uniforms.uSeedCount.value = count
    sim.uniforms.uPhase.value = elapsed

    const stepsPerSecond = Math.max(params[P.speed] ?? 1, 0) * STEPS_PER_SECOND
    const steps = planSteps(elapsed, stepsPerSecond, r.done, MAX_STEPS_PER_FRAME)
    if (steps > 0 || r.init) {
      sim.run(state.gl, steps, r.init)
      r.done += steps
      r.init = false
    }

    // lo stato appena calcolato e' quello che il materiale di disegno campiona in questo frame
    const u = uniforms.uSimState
    if (u) u.value = sim.texture
    const texel = uniforms.uSimTexel?.value as THREE.Vector2 | undefined
    if (texel) texel.copy(sim.texel)
    const phase = uniforms.uSimPhase
    if (phase) phase.value = elapsed
    // priorita' fra 0 (aggiornamento uniform dei layer) e 1 (composizione finale): lo stato deve
    // essere pronto prima che la scena venga disegnata, e i parametri gia' letti dallo store
  }, 0.5)

  return null
}
