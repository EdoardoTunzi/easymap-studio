import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useLayersStore, type BlendMode } from '../store/layersStore'
import { useEffectsStore } from '../store/effectsStore'
import type { ParsedShader } from './isfParser'

const FALLBACK_TEXTURE = (() => {
  const data = new Uint8Array([40, 40, 48, 255])
  const tex = new THREE.DataTexture(data, 1, 1, THREE.RGBAFormat)
  tex.needsUpdate = true
  return tex
})()

// Fattori di CustomBlending per ogni blend mode, con output premoltiplicato dallo shader.
// equation = Add per tutti. Vedi isfParser: gl_FragColor = vec4(rgb*a, a).
const BLEND_FACTORS: Record<BlendMode, { src: THREE.BlendingSrcFactor; dst: THREE.BlendingDstFactor }> = {
  normal: { src: THREE.OneFactor, dst: THREE.OneMinusSrcAlphaFactor },
  add: { src: THREE.OneFactor, dst: THREE.OneFactor },
  screen: { src: THREE.OneFactor, dst: THREE.OneMinusSrcColorFactor },
  multiply: { src: THREE.DstColorFactor, dst: THREE.OneMinusSrcAlphaFactor },
}

function buildUniforms(shader: ParsedShader | undefined): Record<string, { value: unknown }> {
  const base: Record<string, { value: unknown }> = {
    uTexture: { value: FALLBACK_TEXTURE },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uScale: { value: 1 },
    uLumaKey: { value: 0 },
    uOpacity: { value: 1 },
    uPalette: { value: Array.from({ length: 5 }, () => new THREE.Vector3(0, 0, 0)) },
    uPaletteCount: { value: 5 },
    uPaletteAmount: { value: 1 },
    uPaletteOn: { value: 0 },
  }
  if (shader) {
    for (const control of shader.controls) {
      base[control.name] = { value: control.default }
    }
    for (const color of shader.colorControls) {
      base[color.name] = { value: new THREE.Vector3(...color.default) }
    }
  }
  return base
}

/** Una singola mesh warpata dai corner-pin, con lo shader e il mixing del suo layer. */
function LayerMesh({ layerId, index }: { layerId: string; index: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const layer = useLayersStore((s) => s.layers.find((l) => l.id === layerId))
  const shaders = useEffectsStore((s) => s.shaders)
  const shader = layer ? shaders.find((s) => s.name === layer.shaderName) : undefined

  // geometria a 4 vertici, warpata in base ai corner-pin
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    geo.setAttribute(
      'uv',
      new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2),
    )
    return geo
  }, [])

  const corners = layer?.corners
  useEffect(() => {
    if (!corners) return
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    // ordine vertici di PlaneGeometry(1,1,1,1) e di corners: TL, TR, BL, BR
    posAttr.setXYZ(0, corners[0].x, corners[0].y, 0)
    posAttr.setXYZ(1, corners[1].x, corners[1].y, 0)
    posAttr.setXYZ(2, corners[2].x, corners[2].y, 0)
    posAttr.setXYZ(3, corners[3].x, corners[3].y, 0)
    posAttr.needsUpdate = true
  }, [geometry, corners])

  // Texture del media in un ref persistente: sopravvive al rimontaggio del materiale
  // (che avviene al cambio shader/blend per via del key), riassegnata ogni frame in useFrame.
  const textureRef = useRef<THREE.Texture>(FALLBACK_TEXTURE)
  const mediaUrl = layer?.media?.url

  useEffect(() => {
    if (!mediaUrl) {
      textureRef.current = FALLBACK_TEXTURE
      return
    }
    const loader = new THREE.TextureLoader()
    let disposed = false
    loader.load(mediaUrl, (tex) => {
      if (disposed) return
      tex.colorSpace = THREE.SRGBColorSpace
      textureRef.current = tex
    })
    return () => {
      disposed = true
    }
  }, [mediaUrl])

  const uniforms = useMemo(() => buildUniforms(shader), [shader])

  useFrame((state) => {
    const mat = materialRef.current
    if (!mat || !shader) return
    const l = useLayersStore.getState().layers.find((x) => x.id === layerId)
    if (!l) return
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    ;(u.uResolution.value as THREE.Vector2).set(state.size.width, state.size.height)
    u.uScale.value = l.size
    u.uLumaKey.value = l.lumaKey
    u.uOpacity.value = l.opacity
    // palette per-layer (gradient map)
    const pal = l.palette
    u.uPaletteOn.value = pal.enabled ? 1 : 0
    u.uPaletteCount.value = pal.count
    u.uPaletteAmount.value = pal.amount
    const palArr = u.uPalette.value as THREE.Vector3[]
    for (let i = 0; i < 5; i++) {
      const c = pal.colors[i] ?? pal.colors[pal.colors.length - 1]
      palArr[i].set(c[0], c[1], c[2])
    }
    // riassegna la texture ogni frame: se il materiale è stato rimontato (cambio shader/blend)
    // il suo uniform uTexture verrebbe altrimenti resettato al fallback → maschera persa
    u.uTexture.value = textureRef.current
    const params = l.params[shader.name] ?? {}
    for (const control of shader.controls) {
      const uniform = u[control.name]
      if (uniform) uniform.value = params[control.name] ?? control.default
    }
  })

  if (!layer || !shader || !layer.visible) return null

  const blend = BLEND_FACTORS[layer.blendMode]

  return (
    <group
      position={[layer.transform.offsetX, layer.transform.offsetY, 0]}
      scale={layer.transform.zoom}
    >
      <mesh geometry={geometry} renderOrder={index}>
        <shaderMaterial
          key={`${shader.name}|${layer.blendMode}`}
          ref={materialRef}
          vertexShader={shader.vertexShader}
          fragmentShader={shader.fragmentShader}
          uniforms={uniforms}
          transparent
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendEquation={THREE.AddEquation}
          blendSrc={blend.src}
          blendDst={blend.dst}
        />
      </mesh>
    </group>
  )
}

/** Impila tutte le mesh dei layer (index 0 = sfondo, ultimo = in primo piano). */
export function ShaderPlane() {
  const layerIds = useLayersStore((s) => s.layers.map((l) => l.id).join(','))
  const ids = layerIds ? layerIds.split(',') : []
  return (
    <>
      {ids.map((id, i) => (
        <LayerMesh key={id} layerId={id} index={i} />
      ))}
    </>
  )
}
