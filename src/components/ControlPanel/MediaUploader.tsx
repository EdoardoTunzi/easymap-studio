import { useRef } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLayersStore } from "@/store/layersStore";
import { detectType, isFullyOpaque } from "@/lib/mediaDetect";

const AUTO_LUMA_KEY = 0.12;
// nomi file troppo lunghi (es. da fotocamera) mandano la colonna della sidebar fuori dai bordi
const MAX_NAME_LENGTH = 20;

function truncateName(name: string): string {
  if (name.length <= MAX_NAME_LENGTH) return name;
  return `${name.slice(0, MAX_NAME_LENGTH - 1)}…`;
}

export function MediaUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  // le sorgenti live hanno il loro pannello (CameraPicker): qui il pulsante resta "vuoto",
  // così è chiaro che caricare un file sostituirebbe la camera
  const media = useLayersStore((s) => {
    const current = s.layers.find((l) => l.id === s.activeLayerId)?.media ?? null;
    return current?.type === "camera" ? null : current;
  });
  const setMedia = useLayersStore((s) => s.setActiveMedia);
  const setLumaKey = useLayersStore((s) => s.setActiveLumaKey);
  const requestFit = useLayersStore((s) => s.requestFit);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const type = detectType(file);
    const id = crypto.randomUUID();

    if (type === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        setMedia({ id, name: file.name, url, type, width: video.videoWidth, height: video.videoHeight, blob: file });
        setLumaKey(0);
        requestFit();
      };
      video.src = url;
      return;
    }

    // immagine o gif: uso <img> per le dimensioni (il primo frame per la gif)
    const img = new Image();
    img.onload = () => {
      setMedia({ id, name: file.name, url, type, width: img.naturalWidth, height: img.naturalHeight, blob: file });
      // il luma key auto ha senso solo per immagini statiche con sfondo opaco
      setLumaKey(type === "image" && isFullyOpaque(img) ? AUTO_LUMA_KEY : 0);
      requestFit();
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="ui-sublabel text-muted-foreground">Media del layer (immagine, GIF o video)</span>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => inputRef.current?.click()} className="min-w-0 flex-1 justify-start gap-2">
          <ImageUp data-icon="inline-start" />
          <span className="truncate" title={media?.name}>
            {media ? truncateName(media.name) : "Carica media…"}
          </span>
        </Button>
        {media && (
          <Button
            variant="ghost"
            className="px-2"
            onClick={() => {
              setMedia(null);
              setLumaKey(0);
            }}
            title="Rimuovi il media da questo layer"
          >
            <Trash2 className="size-3.5 shrink-0" />
          </Button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/webp,image/jpeg,image/gif,video/mp4,video/webm,video/ogg"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
