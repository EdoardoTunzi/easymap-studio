import { useEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { useLayersStore, type BlendMode, type Layer } from '../store/layersStore'
import { useEffectsStore } from '../store/effectsStore'
import type { ParsedShader } from './isfParser'
import { createMediaTexture, FALLBACK_TEXTURE, type MediaTextureController } from './mediaTexture'

const NOOP_CONTROLLER: MediaTextureController = {
  getTexture: () => FALLBACK_TEXTURE,
  tick: () => {},
  dispose: () => {},
}

// Fattori di CustomBlending per ogni blend mode, con output premoltiplicato dallo shader.
// equation = Add per tutti. Vedi isfParser: gl_FragColor = vec4(rgb*a, a).
const BLEND_FACTORS: Record<BlendMode, { src: THREE.BlendingSrcFactor; dst: THREE.BlendingDstFactor }> = {
  normal: { src: THREE.OneFactor, dst: THREE.OneMinusSrcAlphaFactor },
  add: { src: THREE.OneFactor, dst: THREE.OneFactor },
  screen: { src: THREE.OneFactor, dst: THREE.OneMinusSrcColorFactor },
  multiply: { src: THREE.DstColorFactor, dst: THREE.OneMinusSrcAlphaFactor },
}

const MASK_SLOTS = 8

export function buildUniforms(shader: ParsedShader | undefined): Record<string, { value: unknown }> {
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
    uMaskCount: { value: 0 },
    uMaskCenter: { value: Array.from({ length: MASK_SLOTS }, () => new THREE.Vector2()) },
    uMaskHalf: { value: Array.from({ length: MASK_SLOTS }, () => new THREE.Vector2(1, 1)) },
    uMaskRot: { value: new Array(MASK_SLOTS).fill(0) },
    uMaskFeather: { value: new Array(MASK_SLOTS).fill(0) },
    uMaskType: { value: new Array(MASK_SLOTS).fill(0) },
    uMaskInvert: { value: new Array(MASK_SLOTS).fill(0) },
    uMaskTex: { value: FALLBACK_TEXTURE },
    uMaskTexOn: { value: 0 },
    // controlli globali del layer: default neutri (nessuna alterazione)
    uFxSpeed: { value: 1 },
    uFxRotation: { value: 0 },
    uFxOffset: { value: new THREE.Vector2(0, 0) },
    uFxKaleido: { value: 0 },
    uFxMirrorX: { value: 0 },
    uFxMirrorY: { value: 0 },
    uFxPixelate: { value: 0 },
    uFxContrast: { value: 1 },
    uFxBrightness: { value: 1 },
    uFxSaturation: { value: 1 },
    uFxPosterize: { value: 0 },
    uFxInvert: { value: 0 },
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

/** Effetto + opacità effettiva da renderizzare in un passaggio (main = nuovo, ghost = uscente). */
type PassVariant = 'main' | 'ghost'

function passEffect(l: Layer, variant: PassVariant) {
  if (variant === 'main') {
    return {
      shaderName: l.shaderName,
      params: l.params[l.shaderName] ?? {},
      colors: l.colorParams[l.shaderName] ?? {},
      size: l.size,
      palette: l.palette,
      // durante il crossfade il nuovo effetto entra in dissolvenza
      opacity: l.opacity * (l.transition ? l.transition.progress : 1),
    }
  }
  if (!l.transition) return null
  return {
    shaderName: l.transition.shaderName,
    params: l.transition.params,
    colors: l.transition.colors,
    size: l.transition.size,
    palette: l.transition.palette,
    opacity: l.opacity * (1 - l.transition.progress),
  }
}

interface EffectPassProps {
  layerId: string
  variant: PassVariant
  renderOrder: number
  geometry: THREE.PlaneGeometry
  controllerRef: RefObject<MediaTextureController>
  maskTexRef: RefObject<THREE.Texture>
}

/**
 * Un passaggio di rendering del layer: la mesh warpata con UN effetto (shader + uniforms).
 * Il layer ne ha uno ('main'); durante un crossfade se ne aggiunge un secondo ('ghost')
 * con l'effetto uscente, in dissolvenza sotto quello nuovo.
 */
function EffectPass({ layerId, variant, renderOrder, geometry, controllerRef, maskTexRef }: EffectPassProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const layer = useLayersStore((s) => s.layers.find((l) => l.id === layerId))
  const shaders = useEffectsStore((s) => s.shaders)
  const shaderName = variant === 'main' ? layer?.shaderName : layer?.transition?.shaderName
  const shader = shaderName ? shaders.find((s) => s.name === shaderName) : undefined

  const uniforms = useMemo(() => buildUniforms(shader), [shader])

  useFrame((state) => {
    const mat = materialRef.current
    if (!mat || !shader) return
    const l = useLayersStore.getState().layers.find((x) => x.id === layerId)
    if (!l) return
    const fx = passEffect(l, variant)
    if (!fx || fx.shaderName !== shader.name) return
    // il tick del media (video/gif) avviene una sola volta per frame, dal passaggio main
    if (variant === 'main') controllerRef.current.tick(state.clock.elapsedTime)
    const u = mat.uniforms
    u.uTime.value = state.clock.elapsedTime
    ;(u.uResolution.value as THREE.Vector2).set(state.size.width, state.size.height)
    u.uScale.value = fx.size
    u.uLumaKey.value = l.lumaKey
    u.uOpacity.value = fx.opacity
    // controlli globali: proprietà del layer, valgono per qualunque shader
    const g = l.fx
    u.uFxSpeed.value = g.speed
    u.uFxRotation.value = g.rotation
    ;(u.uFxOffset.value as THREE.Vector2).set(g.offsetX, g.offsetY)
    u.uFxKaleido.value = g.kaleido
    u.uFxMirrorX.value = g.mirrorX ? 1 : 0
    u.uFxMirrorY.value = g.mirrorY ? 1 : 0
    u.uFxPixelate.value = g.pixelate
    u.uFxContrast.value = g.contrast
    u.uFxBrightness.value = g.brightness
    u.uFxSaturation.value = g.saturation
    u.uFxPosterize.value = g.posterize
    u.uFxInvert.value = g.invert
    // palette del passaggio (gradient map)
    const pal = fx.palette
    u.uPaletteOn.value = pal.enabled ? 1 : 0
    u.uPaletteCount.value = pal.count
    u.uPaletteAmount.value = pal.amount
    const palArr = u.uPalette.value as THREE.Vector3[]
    for (let i = 0; i < 5; i++) {
      const c = pal.colors[i] ?? pal.colors[pal.colors.length - 1]
      palArr[i].set(c[0], c[1], c[2])
    }
    // maschere di forma (condivise dal layer)
    const count = Math.min(l.masks.length, MASK_SLOTS)
    u.uMaskCount.value = count
    const centers = u.uMaskCenter.value as THREE.Vector2[]
    const halves = u.uMaskHalf.value as THREE.Vector2[]
    const rot = u.uMaskRot.value as number[]
    const feather = u.uMaskFeather.value as number[]
    const type = u.uMaskType.value as number[]
    const invert = u.uMaskInvert.value as number[]
    for (let i = 0; i < count; i++) {
      const m = l.masks[i]
      centers[i].set(m.cx, m.cy)
      halves[i].set(m.hx, m.hy)
      rot[i] = m.rotation
      feather[i] = m.feather
      type[i] = m.type === 'ellipse' ? 1 : 0
      invert[i] = m.invert ? 1 : 0
    }
    // maschera-immagine
    u.uMaskTexOn.value = l.maskImage ? 1 : 0
    u.uMaskTex.value = maskTexRef.current
    // texture del contenuto (riassegnata ogni frame: sopravvive al rimontaggio del materiale)
    u.uTexture.value = controllerRef.current.getTexture()
    for (const control of shader.controls) {
      const uniform = u[control.name]
      if (uniform) uniform.value = fx.params[control.name] ?? control.default
    }
    for (const color of shader.colorControls) {
      const uniform = u[color.name]
      if (uniform) {
        const c = fx.colors[color.name] ?? color.default
        ;(uniform.value as THREE.Vector3).set(c[0], c[1], c[2])
      }
    }
  })

  if (!layer || !shader || !layer.visible) return null

  const blend = BLEND_FACTORS[layer.blendMode]

  return (
    <mesh geometry={geometry} renderOrder={renderOrder}>
      <shaderMaterial
        // shader.id (non il nome): un visual generativo rigenerato mantiene il nome ma cambia
        // sorgente, e senza ricreare il materiale Three riuserebbe il programma GLSL già compilato
        key={`${shader.id}|${layer.blendMode}`}
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
  )
}

/** Una singola mesh warpata dai corner-pin, con lo shader, il contenuto e le maschere del suo layer. */
function LayerMesh({ layerId, index }: { layerId: string; index: number }) {
  const layer = useLayersStore((s) => s.layers.find((l) => l.id === layerId))

  // geometria a 4 vertici, warpata in base ai corner-pin (condivisa dai passaggi main/ghost)
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

  // Controller della texture del contenuto (immagine/video/gif), ricreato al cambio media.
  const controllerRef = useRef<MediaTextureController>(NOOP_CONTROLLER)
  const mediaUrl = layer?.media?.url
  const mediaType = layer?.media?.type
  const media = layer?.media
  useEffect(() => {
    controllerRef.current = media ? createMediaTexture(media) : NOOP_CONTROLLER
    return () => controllerRef.current.dispose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaUrl, mediaType])

  // Texture della maschera-immagine (stencil), caricata dall'url quando cambia.
  const maskTexRef = useRef<THREE.Texture>(FALLBACK_TEXTURE)
  const maskImageUrl = layer?.maskImage?.url
  useEffect(() => {
    if (!maskImageUrl) {
      maskTexRef.current = FALLBACK_TEXTURE
      return
    }
    const loader = new THREE.TextureLoader()
    let disposed = false
    loader.load(maskImageUrl, (tex) => {
      if (disposed) return
      tex.colorSpace = THREE.SRGBColorSpace
      maskTexRef.current = tex
    })
    return () => {
      disposed = true
    }
  }, [maskImageUrl])

  if (!layer) return null

  const passProps = { layerId, geometry, controllerRef, maskTexRef }

  return (
    <group
      position={[layer.transform.offsetX, layer.transform.offsetY, 0]}
      scale={layer.transform.zoom}
    >
      {/* effetto uscente sotto (renderOrder minore), nuovo effetto sopra: crossfade */}
      {layer.transition && <EffectPass {...passProps} variant="ghost" renderOrder={index * 2} />}
      <EffectPass {...passProps} variant="main" renderOrder={index * 2 + 1} />
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
