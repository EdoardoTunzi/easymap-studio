import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useProjectStore } from '../store/projectStore'
import { useEffectsStore } from '../store/effectsStore'

const FALLBACK_TEXTURE = (() => {
  const data = new Uint8Array([40, 40, 48, 255])
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
})()

export function ShaderPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const media = useProjectStore((s) => s.media)
  const corners = useProjectStore((s) => s.corners)
  const transform = useProjectStore((s) => s.transform)
  const activeShaderName = useEffectsStore((s) => s.activeShaderName)
  const shaders = useEffectsStore((s) => s.shaders)
  const shader = shaders.find((s) => s.name === activeShaderName)

  // geometria a 4 vertici, warpata in base ai corner-pin
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    geo.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2),
    )
    return geo
  }, [])

  useEffect(() => {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    // ordine vertici di PlaneGeometry(1,1,1,1) e di corners: TL, TR, BL, BR
    posAttr.setXYZ(0, corners[0].x, corners[0].y, 0)
    posAttr.setXYZ(1, corners[1].x, corners[1].y, 0)
    posAttr.setXYZ(2, corners[2].x, corners[2].y, 0)
    posAttr.setXYZ(3, corners[3].x, corners[3].y, 0)
    posAttr.needsUpdate = true
  }, [geometry, corners])

  // Texture corrente del media in un ref persistente: sopravvive al rimontaggio del materiale
  // (che avviene al cambio shader per via del key), riassegnata ogni frame in useFrame.
  const textureRef = useRef<THREE.Texture>(FALLBACK_TEXTURE)

  useEffect(() => {
    if (!media) {
      textureRef.current = FALLBACK_TEXTURE
      return
    }
    const loader = new THREE.TextureLoader()
    let disposed = false
    loader.load(media.url, (tex) => {
      if (disposed) return
      tex.colorSpace = THREE.SRGBColorSpace
      textureRef.current = tex
    })
    return () => {
      disposed = true
    }
  }, [media])

  const uniforms = useMemo(() => {
    const base: Record<string, { value: unknown }> = {
      uTexture: { value: textureRef.current },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uScale: { value: 1 },
      uLumaKey: { value: 0 },
    }
    if (shader) {
      for (const control of shader.controls) {
        base[control.name] = { value: control.default }
      }
    }
    return base
  }, [shader])

  useFrame((state) => {
    if (!materialRef.current || !shader) return
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime
    materialRef.current.uniforms.uResolution.value.set(
      state.size.width,
      state.size.height,
    )
    materialRef.current.uniforms.uScale.value = useEffectsStore.getState().size
    materialRef.current.uniforms.uLumaKey.value = useProjectStore.getState().lumaKey
    // riassegna la texture ogni frame: se il materiale è stato rimontato (cambio shader)
    // il suo uniform uTexture verrebbe altrimenti resettato al fallback → maschera persa
    materialRef.current.uniforms.uTexture.value = textureRef.current
    const params = useEffectsStore.getState().params[shader.name] ?? {}
    for (const control of shader.controls) {
      const uniform = materialRef.current.uniforms[control.name]
      if (uniform) uniform.value = params[control.name] ?? control.default
    }
  })

  if (!shader) return null

  return (
    <group
      position={[transform.offsetX, transform.offsetY, 0]}
      scale={transform.zoom}
    >
      <mesh geometry={geometry}>
        <shaderMaterial
          key={shader.name}
          ref={materialRef}
          vertexShader={shader.vertexShader}
          fragmentShader={shader.fragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}
