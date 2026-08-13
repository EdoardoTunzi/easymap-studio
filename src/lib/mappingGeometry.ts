// Operazioni geometriche sul corner-pin di un layer. Sono funzioni pure sui 4 corner
// (ordine TL, TR, BL, BR) in coordinate mondo.
//
// Scelta chiave: rotazione, scala non uniforme e flip agiscono sui corner esistenti invece di
// aggiungere campi a `Transform`. I corner sono già persistiti e sincronizzati con l'Output,
// quindi queste operazioni non richiedono modifiche a shader, persistence o sync.

import type { Corner, Corners } from '../store/projectStore'

/** Centro geometrico dei 4 corner: perno di rotazione e scala. */
export function cornersCentroid(corners: Corners): Corner {
  return {
    x: (corners[0].x + corners[1].x + corners[2].x + corners[3].x) / 4,
    y: (corners[0].y + corners[1].y + corners[2].y + corners[3].y) / 4,
  }
}

function mapCorners(corners: Corners, fn: (c: Corner) => Corner): Corners {
  return corners.map(fn) as Corners
}

/** Ruota i corner attorno al loro centro. `radians` positivo = senso antiorario. */
export function rotateCorners(corners: Corners, radians: number): Corners {
  const c = cornersCentroid(corners)
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  return mapCorners(corners, (p) => {
    const dx = p.x - c.x
    const dy = p.y - c.y
    return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos }
  })
}

/** Scala i corner attorno al loro centro, con fattori indipendenti per asse. */
export function scaleCorners(corners: Corners, sx: number, sy: number): Corners {
  const c = cornersCentroid(corners)
  return mapCorners(corners, (p) => ({
    x: c.x + (p.x - c.x) * sx,
    y: c.y + (p.y - c.y) * sy,
  }))
}

/**
 * Specchia la proiezione scambiando i corner invece di spostarli: ogni vertice porta con sé la
 * propria uv, quindi scambiare TL con TR fa disegnare a destra il lato sinistro della texture.
 * Il quad resta esattamente dov'è — è il contenuto a ribaltarsi.
 */
export function flipCorners(corners: Corners, axis: 'horizontal' | 'vertical'): Corners {
  const [tl, tr, bl, br] = corners
  return axis === 'horizontal'
    ? [{ ...tr }, { ...tl }, { ...br }, { ...bl }]
    : [{ ...bl }, { ...br }, { ...tl }, { ...tr }]
}

/**
 * Azzera la deformazione del corner-pin riportando i corner a un rettangolo allineato agli assi,
 * conservando centro e dimensioni medie. Serve a ripartire da una base pulita quando il warp è
 * diventato ingestibile, senza perdere posizione e scala raggiunte.
 */
export function straightenCorners(corners: Corners): Corners {
  const [tl, tr, bl, br] = corners
  const c = cornersCentroid(corners)
  const dist = (a: Corner, b: Corner) => Math.hypot(a.x - b.x, a.y - b.y)
  const halfWidth = (dist(tl, tr) + dist(bl, br)) / 4
  const halfHeight = (dist(tl, bl) + dist(tr, br)) / 4
  return [
    { x: c.x - halfWidth, y: c.y + halfHeight },
    { x: c.x + halfWidth, y: c.y + halfHeight },
    { x: c.x - halfWidth, y: c.y - halfHeight },
    { x: c.x + halfWidth, y: c.y - halfHeight },
  ]
}

/** Aggancia un valore mondo al multiplo di `step` più vicino. */
export function snapValue(value: number, step: number): number {
  if (step <= 0) return value
  return Math.round(value / step) * step
}

export function snapCorner(corner: Corner, step: number): Corner {
  return { x: snapValue(corner.x, step), y: snapValue(corner.y, step) }
}
