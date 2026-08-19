import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { ShaderPlane } from './ShaderPlane'
import { AutoFit } from './AutoFit'
import { TestPattern } from './TestPattern'
import { OutputComposer } from './OutputComposer'
import { QualityCard } from './QualityCard'
import { tickAudio } from './audioInput'
import { useUiStore, type ViewTransform } from '../store/uiStore'

/** Legge un frame di forma d'onda per tutta la scena (no-op a ingresso audio spento). */
function AudioSampler() {
  useFrame((state) => tickAudio(state.clock.elapsedTime))
  return null
}

/**
 * Mantiene il frustum ortografico -1..1 in verticale, corretto per aspect ratio in orizzontale.
 * Se viene passato `view` (solo finestra Control), il frustum viene scalato/traslato per lo
 * zoom/pan di anteprima: puramente visivo, non altera corners/transform dei layer.
 */
function ResponsiveCamera({ view }: { view?: ViewTransform }) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)
  const zoom = view?.zoom ?? 1
  const panX = view?.panX ?? 0
  const panY = view?.panY ?? 0

  useEffect(() => {
    const aspect = size.width / size.height
    const halfWidth = aspect / zoom
    const halfHeight = 1 / zoom
    camera.left = -halfWidth + panX
    camera.right = halfWidth + panX
    camera.top = halfHeight + panY
    camera.bottom = -halfHeight + panY
    camera.near = 0.1
    camera.far = 100
    camera.updateProjectionMatrix()
  }, [camera, size, zoom, panX, panY])

  return null
}

interface StageCanvasProps {
  /** Attiva l'adattamento automatico dei corner al caricamento media/reset. Solo per la finestra di Controllo. */
  autoFit?: boolean
  /** Applica lo zoom/pan di anteprima (uiStore.view). Solo per la finestra di Controllo: l'Output non lo legge mai. */
  controlView?: boolean
  /**
   * Quale delle due finestre stiamo disegnando. Distingue chi ha diritto al supersampling:
   * durante un set le due finestre girano sulla **stessa GPU**, e far pagare all'anteprima il
   * quadruplo dei pixel significherebbe toglierli al proiettore, che è l'unico schermo che conta.
   */
  role?: 'control' | 'output'
}

/** Canvas condiviso da Control e Output: renderizza il piano con lo shader attivo. */
export function StageCanvas({ autoFit = false, controlView = false, role = 'output' }: StageCanvasProps) {
  const view = useUiStore((s) => s.view)
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10] }}
      // `flat` = nessuna curva di tone mapping sull'immagine. Per un proiettore è la scelta
      // giusta: il bianco pieno deve arrivare a fondo scala (è luce che si paga in lumen) e i
      // colori saturi non devono essere desaturati da una curva cinematografica.
      flat
      // niente MSAA: il canvas riceve solo il quad del compositore, che non ha bordi da smussare.
      // L'antialiasing vero lo fa il supersampling in OutputComposer.
      gl={{ antialias: false }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    >
      <ResponsiveCamera view={controlView ? view : undefined} />
      <AudioSampler />
      {autoFit && <AutoFit />}
      <ShaderPlane />
      {/* la griglia di calibrazione va anche sul proiettore: è lì che serve per allinearsi all'oggetto */}
      <TestPattern />
      {/* sopra tutto quando acceso: si tara la resa, non si guarda la scena */}
      <QualityCard />
      {/* per ultimo: da qui in poi il ciclo di disegno è suo */}
      <OutputComposer role={role} />
    </Canvas>
  )
}
