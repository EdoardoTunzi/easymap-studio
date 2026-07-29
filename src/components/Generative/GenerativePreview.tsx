import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { buildUniforms } from '@/engine/ShaderPlane'
import { useGenerativeStore } from '@/store/generativeStore'
import type { ParsedShader } from '@/engine/isfParser'

/**
 * Anteprima live del draft: versione minima di EffectPass (nessun media, maschera o crossfade).
 * I valori dei parametri sono i `@default` della sorgente composta, che il Generative Lab tiene
 * già allineati ai controlli — quindi qui basta il buildUniforms condiviso.
 */
function PreviewQuad({ shader }: { shader: ParsedShader }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)
  const size = useThree((s) => s.size)
  const uniforms = useMemo(() => buildUniforms(shader), [shader])

  useFrame((state) => {
    const mat = materialRef.current
    if (!mat) return
    mat.uniforms.uTime.value = state.clock.elapsedTime
    ;(mat.uniforms.uResolution.value as THREE.Vector2).set(size.width, size.height)
  })

  return (
    <mesh>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        key={shader.id}
        ref={materialRef}
        vertexShader={shader.vertexShader}
        fragmentShader={shader.fragmentShader}
        uniforms={uniforms}
        transparent
      />
    </mesh>
  )
}

export function GenerativePreview() {
  const shader = useGenerativeStore((s) => s.shader)

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border bg-black">
      {/* inset-0 assoluto: il canvas R3F si dimensiona dal contenitore invece di dettarne
          l'altezza, altrimenti crescerebbe ignorando l'aspect-ratio e allargherebbe il pannello */}
      <div className="absolute inset-0">
        {shader ? (
          <Canvas
            orthographic
            camera={{ position: [0, 0, 5], left: -1, right: 1, top: 1, bottom: -1 }}
            gl={{ antialias: true }}
            style={{ width: '100%', height: '100%', display: 'block' }}
          >
            <PreviewQuad shader={shader} />
          </Canvas>
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center text-xs text-muted-foreground">
            Sorgente GLSL non valida: manca <code className="mx-1">processColor</code>
          </div>
        )}
      </div>
    </div>
  )
}
