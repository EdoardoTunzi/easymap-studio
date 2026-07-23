import { useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import type * as THREE from 'three'
import { ShaderPlane } from './ShaderPlane'
import { AutoFit } from './AutoFit'

/** Mantiene il frustum ortografico -1..1 in verticale, corretto per aspect ratio in orizzontale. */
function ResponsiveCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera
  const size = useThree((s) => s.size)

  useEffect(() => {
    const aspect = size.width / size.height
    camera.left = -aspect
    camera.right = aspect
    camera.top = 1
    camera.bottom = -1
    camera.near = 0.1
    camera.far = 100
    camera.updateProjectionMatrix()
  }, [camera, size])

  return null
}

interface StageCanvasProps {
  /** Attiva l'adattamento automatico dei corner al caricamento media/reset. Solo per la finestra di Controllo. */
  autoFit?: boolean
}

/** Canvas condiviso da Control e Output: renderizza il piano con lo shader attivo. */
export function StageCanvas({ autoFit = false }: StageCanvasProps) {
  return (
    <Canvas
      orthographic
      camera={{ position: [0, 0, 10] }}
      gl={{ antialias: true }}
      style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
    >
      <ResponsiveCamera />
      {autoFit && <AutoFit />}
      <ShaderPlane />
    </Canvas>
  )
}
