// Costruzione della mesh del layer a partire da corner-pin e curvatura dei bordi.
//
// Ogni vertice porta, oltre alla posizione mondo, l'attributo `aPersp` (= 1/W dell'omografia):
// è il peso con cui il fragment shader ricostruisce la uv proiettivamente corretta. Senza, le uv
// si interpolerebbero linearmente sui due triangoli e la texture si spezzerebbe lungo la diagonale
// a ogni keystone. Vedi `src/lib/warp.ts` per la matematica.

import * as THREE from 'three'
import type { Corners } from '../store/projectStore'
import {
  cornersHomography,
  warpCurves,
  warpPoint,
  isWarpActive,
  WARP_SUBDIVISIONS,
  type Warp,
} from '../lib/warp'

/** Nome dell'attributo del peso prospettico, atteso dal vertex shader del wrapper GLSL. */
export const PERSP_ATTRIBUTE = 'aPersp'

/** Suddivisioni della mesh: 1 quad senza warp (costo identico a prima), griglia fitta con warp. */
export function warpSegments(warp: Warp | null | undefined): number {
  return isWarpActive(warp) ? WARP_SUBDIVISIONS : 1
}

export function createWarpGeometry(segments: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(1, 1, segments, segments)
  const count = geo.getAttribute('position').count
  geo.setAttribute(
    PERSP_ATTRIBUTE,
    new THREE.Float32BufferAttribute(new Float32Array(count).fill(1), 1),
  )
  return geo
}

/**
 * Porta i vertici del quadrato unitario sui corner passando per la curvatura dei bordi.
 * Le uv restano quelle della PlaneGeometry (regolari): è la posizione a deformarsi, quindi il
 * contenuto resta incollato alla superficie piegata invece di scorrerci sopra.
 */
export function updateWarpGeometry(
  geometry: THREE.BufferGeometry,
  corners: Corners,
  warp: Warp | null | undefined,
): void {
  const m = cornersHomography(corners)
  const curves = warpCurves(warp)
  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  const persp = geometry.getAttribute(PERSP_ATTRIBUTE) as THREE.BufferAttribute | undefined

  for (let i = 0; i < position.count; i++) {
    const p = warpPoint(curves, m, uv.getX(i), uv.getY(i))
    position.setXYZ(i, p.x, p.y, 0)
    persp?.setX(i, p.k)
  }
  position.needsUpdate = true
  if (persp) persp.needsUpdate = true
  // i vertici escono dai limiti della PlaneGeometry originale: senza ricalcolo il frustum culling
  // userebbe una sfera troppo piccola e potrebbe far sparire la mesh a mapping molto spostati
  geometry.computeBoundingSphere()
}
