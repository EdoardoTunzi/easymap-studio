import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, FolderOpen, Pause, Play, RefreshCw, Repeat, Shuffle, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLayersStore } from "@/store/layersStore";
import type { MediaAsset } from "@/store/projectStore";
import {
  useAssetPlaylistStore,
  activeItems,
  MAX_ASSET_INTERVAL,
  MIN_ASSET_INTERVAL,
  type AssetPlaylistData
} from "@/store/assetPlaylistStore";
import {
  assetUrl,
  folderPermission,
  mergeFolderItems,
  pickAssetFolder,
  readFolderItems,
  supportsAssetFolder,
  unpinLayerAsset,
  type AssetItem
} from "@/lib/assetFolder";
import { applyAssetTick, forgetAssetMedia } from "@/lib/sync";

/** Larghezza di un blocco: fissa, perché qui la durata è unica per tutta la playlist. */
const ITEM_PX = 88;

/**
 * Monta il contenuto solo quando entra nella parte visibile della barra. È il motivo per cui una
 * cartella da duecento clip non costa nulla ad aprirsi: le anteprime si decodificano una alla
 * volta, mano a mano che le si scorre. Il margine anticipa il caricamento di un paio di blocchi,
 * così scorrendo non si vedono buchi.
 */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);
  return [ref, inView] as const;
}

/** Primo frame dell'asset. Per i video si usa il poster nativo (`#t=`), niente thumbnail da generare. */
function AssetThumb({ dir, item }: { dir: FileSystemDirectoryHandle; item: AssetItem }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const [asset, setAsset] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!inView) return;
    let alive = true;
    void assetUrl(dir, item).then((a) => {
      if (alive) setAsset(a);
    });
    return () => {
      alive = false;
    };
    // le proprietà, non l'oggetto: `item` cambia identità a ogni riordino o esclusione, e
    // ricaricherebbe l'anteprima per nulla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, dir, item.name, item.type]);

  const className = "size-full rounded-md object-cover ring-1 ring-black/5 dark:ring-white/5";

  return (
    <div ref={ref} className="relative my-0.5 min-h-0 w-full flex-1">
      {!asset ? (
        <Skeleton className="size-full rounded-md" />
      ) : asset.type === "video" ? (
        // preload=metadata scarica solo l'intestazione: il frame a 0,1s basta per riconoscere la clip
        <video src={`${asset.url}#t=0.1`} preload="metadata" muted playsInline className={className} />
      ) : (
        <img src={asset.url} alt="" draggable={false} className={className} />
      )}
    </div>
  );
}

function AssetBlock({
  layerId,
  dir,
  item,
  index,
  isCurrent,
  intervalSec,
  playing,
  isDragOver,
  onDragStart,
  onDragOverIndex,
  onDrop,
  onDragEnd
}: {
  layerId: string;
  dir: FileSystemDirectoryHandle;
  item: AssetItem;
  index: number;
  isCurrent: boolean;
  intervalSec: number;
  playing: boolean;
  isDragOver: boolean;
  onDragStart: () => void;
  onDragOverIndex: () => void;
  onDrop: () => void;
  onDragEnd: () => void;
}) {
  const toggleItem = useAssetPlaylistStore((s) => s.toggleItem);
  const setIndex = useAssetPlaylistStore((s) => s.setIndex);

  /** Manda in onda subito questa clip: è il gesto principale di un set dal vivo. */
  const jump = async () => {
    const media = await assetUrl(dir, item, layerId);
    if (!media) return;
    applyAssetTick(layerId, media);
    // una clip esclusa (index -1) si può guardare, ma non entra nella rotazione: l'indice non si
    // tocca, e al prossimo scatto la sequenza riprende da dov'era
    if (index >= 0) setIndex(layerId, index); // il motore lo vede cambiato e riparte da adesso
  };

  return (
    <button
      type="button"
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOverIndex();
      }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={() => void jump()}
      style={{ width: ITEM_PX }}
      title={`${item.name} — clicca per mandarla in onda`}
      className={cn(
        "group relative flex h-full shrink-0 cursor-grab select-none flex-col justify-between overflow-hidden rounded-lg border px-2 py-1.5 text-left active:cursor-grabbing",
        "transition-colors duration-[--dur-fast] ease-[--ease-out]",
        isCurrent ? "border-primary/70 bg-sidebar-accent/70" : "border-transparent bg-sidebar-accent/25 hover:bg-sidebar-accent/45",
        !item.enabled && "opacity-40",
        isDragOver && "border-l-4 border-l-primary"
      )}
    >
      {/* playhead: quanto manca al prossimo cambio. È un'animazione CSS riavviata dal `key`, non un
          rAF: il conto è lineare e non deve costare un re-render per frame durante un live. */}
      {isCurrent && playing && (
        <span
          key={`${index}-${intervalSec}`}
          className="asset-playhead pointer-events-none absolute inset-y-0 left-0 w-full origin-left bg-primary/10"
          style={{ animationDuration: `${intervalSec}s` }}
        />
      )}
      <span className="relative flex items-center gap-1.5 truncate">
        {isCurrent && playing && <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-primary" />}
        <span className="ui-label truncate font-medium text-foreground">{item.name}</span>
      </span>

      <AssetThumb dir={dir} item={item} />

      <span className="relative truncate text-[10px] uppercase text-muted-foreground">{item.type}</span>

      {/* esclusione dalla rotazione: la clip resta in elenco ma viene saltata. Sempre visibile
          dove non esiste hover (touch), altrimenti sarebbe irraggiungibile. */}
      <div
        className={cn(
          "absolute right-1.5 top-1.5 z-10 rounded-md bg-card/90 p-0.5 opacity-0 shadow-sm backdrop-blur-sm",
          "transition-opacity duration-[--dur-fast] ease-[--ease-out]",
          "group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100"
        )}
      >
        <span
          role="button"
          tabIndex={0}
          aria-label={item.enabled ? "Escludi dalla rotazione" : "Includi nella rotazione"}
          title={item.enabled ? "Escludi dalla rotazione" : "Includi nella rotazione"}
          onClick={(e) => {
            e.stopPropagation();
            toggleItem(layerId, item.name);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.stopPropagation();
            e.preventDefault();
            toggleItem(layerId, item.name);
          }}
          className="press flex size-5 items-center justify-center rounded text-muted-foreground transition-colors duration-[--dur-fast] ease-[--ease-out] hover:bg-accent hover:text-foreground"
        >
          {item.enabled ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </span>
      </div>
    </button>
  );
}

/** Messaggi a tutta barra (nessuna cartella, browser non supportato, permesso da riconcedere). */
function BarNotice({ children }: { children: React.ReactNode }) {
  return <p className="ui-sublabel flex-1 self-center leading-relaxed text-muted-foreground/80">{children}</p>;
}

/**
 * Tab "Assets" della barra playlist: la rotazione dei **contenuti** del layer attivo, pescati da
 * una cartella su disco. Indipendente dalla playlist degli effetti, che può girare in parallelo
 * sullo stesso layer.
 *
 * Qui c'è solo l'interfaccia: il motore è `useAssetPlaylist`, montato nella pagina, così passando
 * sulla tab Effetti la rotazione non si ferma.
 */
export function AssetPlaylistBar({ scrollRef }: { scrollRef: React.RefObject<HTMLDivElement | null> }) {
  const layerId = useLayersStore((s) => s.activeLayerId);
  const layerName = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId)?.name ?? "");
  const data = useAssetPlaylistStore((s) => s.playlists[layerId]) as AssetPlaylistData | undefined;
  const playing = useAssetPlaylistStore((s) => s.playing[layerId] ?? false);
  const index = useAssetPlaylistStore((s) => s.index[layerId] ?? -1);
  const { setFolder, clearFolder, setItems, reorderItems, setInterval, setShuffle, setLoop, setPlaying } =
    useAssetPlaylistStore.getState();

  const supported = supportsAssetFolder();
  // il permesso non sopravvive al riavvio: l'handle salvato col progetto va riautorizzato a mano
  const [granted, setGranted] = useState(false);
  const dir = data?.dir;

  useEffect(() => {
    if (!dir) {
      setGranted(false);
      return;
    }
    let alive = true;
    void folderPermission(dir, false).then((ok) => alive && setGranted(ok));
    return () => {
      alive = false;
    };
  }, [dir]);

  const dragIndex = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const items = data?.items ?? [];
  const rotating = activeItems(data);
  const currentName = rotating[index]?.name;

  const choose = async () => {
    const picked = await pickAssetFolder();
    if (!picked) return;
    setFolder(layerId, picked.dir, picked.items);
    setGranted(true);
  };

  const reconnect = async () => {
    if (!dir) return;
    if (!(await folderPermission(dir, true))) return;
    setGranted(true);
    setItems(layerId, mergeFolderItems(items, await readFolderItems(dir)));
  };

  const refresh = async () => {
    if (!dir || !(await folderPermission(dir, true))) return;
    setItems(layerId, mergeFolderItems(items, await readFolderItems(dir)));
  };

  const unlink = () => {
    setPlaying(layerId, false);
    unpinLayerAsset(layerId);
    forgetAssetMedia(layerId);
    clearFolder(layerId);
  };

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          size="icon"
          variant={playing ? "default" : "secondary"}
          onClick={() => setPlaying(layerId, !playing)}
          disabled={!granted || rotating.length === 0}
          aria-label={playing ? "Pausa" : "Play"}
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLoop(layerId, !data?.loop)}
          // con la riproduzione casuale non esiste una fine da ripetere: il loop è implicito
          disabled={!data || data.shuffle}
          aria-label="Loop"
          title={data?.loop ? "Loop attivo: la cartella si ripete" : "Loop spento: si ferma sull’ultima clip"}
          className={cn(data?.loop ? "text-primary" : "text-muted-foreground")}
        >
          <Repeat className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShuffle(layerId, !data?.shuffle)}
          disabled={!data}
          aria-label="Ordine casuale"
          title={data?.shuffle ? "Ordine casuale" : "Ordine della cartella"}
          className={cn(data?.shuffle ? "text-primary" : "text-muted-foreground")}
        >
          <Shuffle className="size-4" />
        </Button>
        <div className="flex items-center gap-1">
          <span className="ui-sublabel text-muted-foreground">ogni</span>
          <Input
            type="number"
            min={MIN_ASSET_INTERVAL}
            max={MAX_ASSET_INTERVAL}
            step={0.5}
            value={data?.intervalSec ?? 5}
            disabled={!data}
            onChange={(e) => setInterval(layerId, Number(e.target.value))}
            className="h-8 w-16"
            aria-label="Ogni quanti secondi cambia asset"
          />
          <span className="text-xs text-muted-foreground">s</span>
        </div>
      </div>

      <Separator orientation="vertical" className="h-auto" />

      <div ref={scrollRef} className="timeline-scroll flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto pb-1">
        {!supported ? (
          <BarNotice>
            La lettura di una cartella richiede Chrome o Edge. Negli altri browser resta il caricamento singolo dal pannello “Sorgente”.
          </BarNotice>
        ) : !dir ? (
          <BarNotice>
            Collega una cartella di immagini, GIF o video a <strong className="font-medium text-foreground">{layerName}</strong>: le clip si
            alterneranno da sole nel layer. I file restano su disco, l’app apre solo quella in onda.
          </BarNotice>
        ) : !granted ? (
          <BarNotice>
            Il progetto ricorda la cartella <strong className="font-medium text-foreground">{data.dirName}</strong>, ma il browser ne chiede di
            nuovo il permesso a ogni avvio.
          </BarNotice>
        ) : items.length === 0 ? (
          <BarNotice>Nessun file supportato in “{data.dirName}”. Aggiungine e premi Aggiorna.</BarNotice>
        ) : (
          items.map((item, i) => (
            <AssetBlock
              key={item.name}
              layerId={layerId}
              dir={dir}
              item={item}
              index={rotating.findIndex((r) => r.name === item.name)}
              isCurrent={item.name === currentName}
              intervalSec={data.intervalSec}
              playing={playing}
              isDragOver={dragOver === i}
              onDragStart={() => (dragIndex.current = i)}
              onDragOverIndex={() => setDragOver(i)}
              onDrop={() => {
                if (dragIndex.current != null) reorderItems(layerId, dragIndex.current, i);
                dragIndex.current = null;
                setDragOver(null);
              }}
              onDragEnd={() => {
                dragIndex.current = null;
                setDragOver(null);
              }}
            />
          ))
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 self-center">
        {dir && !granted && (
          <Button size="sm" onClick={() => void reconnect()}>
            <FolderOpen data-icon="inline-start" />
            Riconnetti
          </Button>
        )}
        {dir && granted && (
          <>
            <Button size="icon" variant="ghost" onClick={() => void refresh()} aria-label="Rileggi la cartella" title="Rileggi la cartella">
              <RefreshCw className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={unlink} aria-label="Scollega la cartella" title="Scollega la cartella">
              <Unlink className="size-4" />
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={() => void choose()} disabled={!supported}>
          <FolderOpen data-icon="inline-start" />
          {dir ? "Cambia" : "Cartella…"}
        </Button>
      </div>
    </>
  );
}
