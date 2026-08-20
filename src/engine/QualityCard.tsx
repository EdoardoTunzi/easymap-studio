import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { useRenderStore } from '../store/renderStore'

/**
 * Cartello di prova della resa, a tutto schermo.
 *
 * Serve a smettere di andare a occhio. Ogni fascia risponde a una domanda precisa:
 *
 * - **Righe da un pixel** — se non si leggono nette e separate, l'immagine non sta arrivando al
 *   proiettore alla sua risoluzione nativa: c'è di mezzo un ridimensionamento (finestra non a
 *   pieno schermo, risoluzione del sistema "scalata", keystone digitale del proiettore acceso).
 *   È il test che nessuna impostazione dell'app può aggiustare, e il primo da fare.
 * - **Gradiente** — se si vedono strisce invece di una sfumatura continua, è banding: si corregge
 *   con il dithering, ed è ciò che più fa sembrare "povero" uno shader generativo al buio.
 * - **Barre sature** — colori a fondo scala. Se sembrano slavati il problema è nella modalità
 *   immagine del proiettore, non nel rendering: qui escono pieni per costruzione.
 * - **Gradini di nero e di bianco** — quanti se ne distinguono dice il contrasto reale della sala
 *   e se le alte luci stanno venendo tagliate.
 *
 * Non passa per la camera: è un quad in coordinate di schermo, quindi non lo toccano né lo zoom
 * dell'anteprima né il corner-pin. Deve misurare i pixel, non la scena.
 */

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform float uPixelScale;   // quanti pixel del buffer interno vale un pixel del proiettore
varying vec2 vUv;

void main() {
  vec3 color;

  if (vUv.y > 0.74) {
    // righe alternate da UN pixel di proiettore: a sinistra verticali, a destra orizzontali
    float coord = vUv.x < 0.5 ? gl_FragCoord.x : gl_FragCoord.y;
    float period = max(uPixelScale, 1.0) * 2.0;
    color = vec3(step(period * 0.5, mod(coord, period)));
  } else if (vUv.y > 0.5) {
    // rampa continua: qui si legge il banding
    color = vec3(vUv.x);
  } else if (vUv.y > 0.28) {
    // sette barre a fondo scala
    float i = floor(vUv.x * 7.0);
    if (i < 0.5) color = vec3(1.0);
    else if (i < 1.5) color = vec3(1.0, 0.0, 0.0);
    else if (i < 2.5) color = vec3(0.0, 1.0, 0.0);
    else if (i < 3.5) color = vec3(0.0, 0.0, 1.0);
    else if (i < 4.5) color = vec3(0.0, 1.0, 1.0);
    else if (i < 5.5) color = vec3(1.0, 0.0, 1.0);
    else color = vec3(1.0, 1.0, 0.0);
  } else {
    // sinistra: neri vicinissimi fra loro (0,2,4,6,8/255) — quanti se ne distinguono è il
    // contrasto vero della sala. Destra: bianchi altrettanto vicini (247..255), per vedere se
    // le alte luci arrivano separate o già tutte appiattite su bianco.
    float i = floor(vUv.x * 10.0);
    float v = i < 5.0 ? i * 2.0 / 255.0 : (247.0 + (i - 5.0) * 2.0) / 255.0;
    color = vec3(v);
  }

  gl_FragColor = vec4(color, 1.0);
}
`

export function QualityCard() {
  const visible = useRenderStore((s) => s.qualityCard)
  const superSample = useRenderStore((s) => s.superSample)
  const dpr = useThree((s) => s.viewport.dpr)
  const materialRef = useRef<THREE.ShaderMaterial>(null)

  const geometry = useMemo(() => new THREE.PlaneGeometry(2, 2), [])

  useFrame(() => {
    const mat = materialRef.current
    if (!mat) return
    // un pixel del proiettore vale dpr × supersampling pixel del buffer in cui stiamo disegnando
    mat.uniforms.uPixelScale.value = Math.max(1, dpr * superSample)
  })

  if (!visible) return null

  return (
    <mesh geometry={geometry} renderOrder={20000} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={{ uPixelScale: { value: 1 } }}
        depthTest={false}
        depthWrite={false}
        // `transparent` pur essendo opaco: Three disegna PRIMA tutti i materiali opachi e POI
        // quelli trasparenti, e il renderOrder ordina solo dentro il proprio gruppo. Da opaco
        // questo quad finirebbe sotto i layer (che sono tutti trasparenti) invece che sopra.
        transparent
      />
    </mesh>
  )
}
