import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useLayersStore } from '../store/layersStore'

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

// Griglia di calibrazione: bordo, reticolo e diagonali servono a leggere a occhio la
// deformazione del quad quando lo si sovrappone all'oggetto reale. Le diagonali in particolare
// rendono evidente una prospettiva sbagliata, che il solo bordo non mostrerebbe.
const FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uCells;

// linea di spessore w centrata sulla distanza dist, con bordi morbidi per non aliasare
float line(float dist, float w) {
  return 1.0 - smoothstep(w * 0.5, w * 0.5 + 0.0015, abs(dist));
}

void main() {
  vec3 color = vec3(0.0);
  float alpha = 0.0;

  // reticolo interno
  vec2 cell = fract(vUv * uCells);
  float grid = max(line(min(cell.x, 1.0 - cell.x), 0.012), line(min(cell.y, 1.0 - cell.y), 0.012));
  color = mix(color, vec3(1.0), grid);
  alpha = max(alpha, grid * 0.55);

  // diagonali: rivelano la distorsione prospettica
  float diag = max(line((vUv.y - vUv.x) * 0.7071, 0.004), line((vUv.y + vUv.x - 1.0) * 0.7071, 0.004));
  color = mix(color, vec3(1.0, 0.25, 0.9), diag);
  alpha = max(alpha, diag * 0.9);

  // bordo esterno: è il riferimento da far coincidere con lo spigolo dell'oggetto
  float border = max(line(min(vUv.x, 1.0 - vUv.x), 0.014), line(min(vUv.y, 1.0 - vUv.y), 0.014));
  color = mix(color, vec3(0.1, 1.0, 1.0), border);
  alpha = max(alpha, border);

  // crocino centrale per allineare il centro della proiezione
  vec2 d = abs(vUv - 0.5);
  float cross = max(line(d.x, 0.006) * step(d.y, 0.06), line(d.y, 0.006) * step(d.x, 0.06));
  color = mix(color, vec3(1.0, 0.85, 0.1), cross);
  alpha = max(alpha, cross);

  if (alpha < 0.01) discard;
  gl_FragColor = vec4(color * alpha, alpha);
}
`

/**
 * Griglia di calibrazione sopra il layer attivo, disegnata identica in Control e in Output.
 * Segue gli stessi corner e lo stesso transform del layer, quindi quello che si allinea in
 * anteprima è esattamente ciò che il proiettore manda sull'oggetto.
 */
export function TestPattern() {
  const on = useLayersStore((s) => s.testPattern)
  const layer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId))

  // stessa geometria a 4 vertici warpata dai corner usata da LayerMesh
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1, 1, 1)
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2))
    return geo
  }, [])

  const uniforms = useMemo(() => ({ uCells: { value: 8 } }), [])

  const corners = layer?.corners
  useEffect(() => {
    if (!corners) return
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    posAttr.setXYZ(0, corners[0].x, corners[0].y, 0)
    posAttr.setXYZ(1, corners[1].x, corners[1].y, 0)
    posAttr.setXYZ(2, corners[2].x, corners[2].y, 0)
    posAttr.setXYZ(3, corners[3].x, corners[3].y, 0)
    posAttr.needsUpdate = true
  }, [geometry, corners])

  useEffect(() => () => geometry.dispose(), [geometry])

  if (!on || !layer) return null

  return (
    <group
      position={[layer.transform.offsetX, layer.transform.offsetY, 0]}
      scale={layer.transform.zoom}
    >
      {/* renderOrder altissimo: la griglia di calibrazione sta sopra ogni layer */}
      <mesh geometry={geometry} renderOrder={100000}>
        <shaderMaterial
          vertexShader={VERTEX_SHADER}
          fragmentShader={FRAGMENT_SHADER}
          uniforms={uniforms}
          transparent
          depthTest={false}
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
        />
      </mesh>
    </group>
  )
}
