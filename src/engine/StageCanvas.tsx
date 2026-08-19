import { useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { ShaderPlane } from './ShaderPlane'
import { AutoFit } from './AutoFit'
import { TestPattern } from './TestPattern'
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
}

/** Canvas condiviso da Control e Output: renderizza il piano con lo shader attivo. */
export function StageCanvas({ autoFit = false, controlView = false }: StageCanvasProps) {
  const view = useUiStore((s) => s.view)
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10] }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    >
      <ResponsiveCamera view={controlView ? view : undefined} />
      <AudioSampler />
      {autoFit && <AutoFit />}
      <ShaderPlane />
      {/* la griglia di calibrazione va anche sul proiettore: è lì che serve per allinearsi all'oggetto */}
      <TestPattern />
    </Canvas>
  )
}
