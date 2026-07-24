import { useRef } from 'react'
import { ImageUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLayersStore } from '@/store/layersStore'

const AUTO_LUMA_KEY = 0.12

/**
 * Verifica se l'immagine ha un canale alpha realmente trasparente. Campiona l'alpha su
 * una versione ridotta: se ogni pixel è opaco, l'immagine ha lo sfondo "pieno" (es. nero)
 * e il ritaglio dovrà usare il luma key invece dell'alpha.
 */
function isFullyOpaque(img: HTMLImageElement): boolean {
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

export function MediaUploader() {
  const inputRef = useRef<HTMLInputElement>(null)
  const media = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.media ?? null)
  const setMedia = useLayersStore((s) => s.setActiveMedia)
  const setLumaKey = useLayersStore((s) => s.setActiveLumaKey)
  const requestFit = useLayersStore((s) => s.requestFit)

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      setMedia({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
        blob: file,
      })
      // sfondo opaco (nessuna trasparenza) → attiva il luma key per ritagliare le zone scure
      setLumaKey(isFullyOpaque(img) ? AUTO_LUMA_KEY : 0)
      requestFit()
    }
    img.src = url
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Media (immagine dello stage/asset)
      </span>
      <Button
        variant="secondary"
        onClick={() => inputRef.current?.click()}
        className="w-full justify-start gap-2"
      >
        <ImageUp className="size-4 shrink-0" />
        <span className="truncate">{media ? media.name : 'Carica immagine…'}</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
