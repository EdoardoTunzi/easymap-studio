/**
 * Verifica se l'immagine ha un canale alpha realmente trasparente. Campiona l'alpha su
 * una versione ridotta: se ogni pixel è opaco, l'immagine ha lo sfondo "pieno" (es. nero)
 * e il ritaglio dovrà usare il luma key invece dell'alpha.
 */
export function isFullyOpaque(img: HTMLImageElement): boolean {
  const max = 128
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(img, 0, 0, w, h)
  const data = ctx.getImageData(0, 0, w, h).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false
  }
  return true
}
