import { useCallback, useEffect, useState } from "react";
import { Layers2, RotateCcw, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLayersStore } from "@/store/layersStore";
import type { Corners } from "@/store/projectStore";
import {
  cameraDiagnostics,
  cameraErrorMessage,
  cameraSupported,
  isCameraBusyError,
  listCameras,
  openCamera,
  releaseCameraStream,
  type CameraDevice,
  type CameraDiagnostics,
} from "@/lib/cameraSources";
import { dropCameraTexture } from "@/engine/mediaTexture";

/**
 * Ingresso video live come contenuto del layer: la ripresa (webcam, capture card HDMI) entra
 * nella scena come qualunque altro media, quindi riceve shader, palette, maschere e corner-pin.
 *
 * Il tasto "Nuovo strato" duplica la sorgente su un layer sopra: è il modo di impilare più
 * effetti sulla stessa ripresa, visto che lo stream è condiviso e il device si apre una volta sola.
 */
/**
 * Nome leggibile della camera. Senza consenso (o su alcune sorgenti virtuali) il browser
 * riporta un'etichetta vuota o l'identificativo grezzo del device: come nome del layer
 * sarebbe una stringa di sessanta caratteri casuali.
 */
function cameraName(label: string): string {
  const clean = label.trim();
  return clean && clean.length <= 48 ? clean : "Camera";
}

export function CameraPicker() {
  const activeLayer = useLayersStore((s) => s.layers.find((l) => l.id === s.activeLayerId) ?? null);
  const media = activeLayer?.media ?? null;
  const setMedia = useLayersStore((s) => s.setActiveMedia);
  const setLumaKey = useLayersStore((s) => s.setActiveLumaKey);
  const requestFit = useLayersStore((s) => s.requestFit);
  const addLayer = useLayersStore((s) => s.addLayer);

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** Stato dell'ambiente, mostrato quando l'apertura fallisce: dice *perché* invece di "non va". */
  const [diag, setDiag] = useState<CameraDiagnostics | null>(null);

  const supported = cameraSupported();
  const isCamera = media?.type === "camera";

  const refreshDevices = useCallback(() => {
    listCameras()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  // la lista si aggiorna quando si collega o si stacca una cam durante il live
  useEffect(() => {
    if (!supported) return;
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [supported, refreshDevices]);

  const activate = async (deviceId: string) => {
    setBusy(true);
    setError(null);
    // camera attualmente sul layer: cambiando sorgente va spenta subito invece di restare accesa
    // per tutto il rilascio ritardato — due webcam USB sullo stesso controller spesso non ci
    // stanno insieme, e la seconda apertura fallirebbe per banda insufficiente
    const previousId = isCamera ? (media?.deviceId ?? "") : null;
    const switching = previousId != null && previousId !== deviceId;
    try {
      let cam: Awaited<ReturnType<typeof openCamera>>;
      try {
        cam = await openCamera(deviceId);
      } catch (err) {
        if (!switching || !isCameraBusyError(err)) throw err;
        // device occupato durante un cambio: libera quello in uso e riprova una volta sola
        dropCameraTexture(previousId);
        cam = await openCamera(deviceId);
      }
      // col consenso appena concesso l'elenco riporta finalmente le etichette: si rilegge subito
      // per dare al layer il nome vero del device invece dell'identificativo grezzo
      const fresh = await listCameras().catch(() => [] as CameraDevice[]);
      if (fresh.length > 0) setDevices(fresh);
      const label = fresh.find((d) => d.deviceId === cam.deviceId)?.label ?? cam.label;
      setMedia({
        id: crypto.randomUUID(),
        name: cameraName(label),
        url: "",
        type: "camera",
        width: cam.width,
        height: cam.height,
        deviceId: cam.deviceId,
      });
      setLumaKey(0); // una ripresa è opaca: il ritaglio si fa semmai con le maschere
      requestFit();
      // il layer prende il suo riferimento allo stream montandosi: questo era solo il probe
      releaseCameraStream(cam.deviceId);
      // spegnimento della sorgente precedente dopo il cambio: il nuovo controller è già nato
      // sul device nuovo, quindi non si vede alcun buco
      if (switching && previousId !== cam.deviceId) dropCameraTexture(previousId);
      setDiag(null);
    } catch (err) {
      setError(cameraErrorMessage(err));
      // fotografa l'ambiente sul momento: senza questo un "non si attiva" resta indistinguibile
      // fra permesso bloccato, pagina non sicura, device occupato e nessuna camera collegata
      setDiag(await cameraDiagnostics(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Riavvio a freddo della sorgente: chiude stream e texture e riapre il device. È la mossa da
   * fare dal vivo se l'immagine si pianta (cam staccata, device rubato da un'altra app).
   */
  const restart = async () => {
    dropCameraTexture(media?.deviceId ?? "");
    await activate(media?.deviceId ?? "");
  };

  /**
   * Stesso feed su un nuovo layer in primo piano: un secondo effetto sopra la stessa ripresa.
   * Nasce già allineato (corner e transform copiati) e in Screen, altrimenti coprirebbe
   * semplicemente il layer sotto invece di sommarcisi.
   */
  const addFxLayer = () => {
    if (!activeLayer?.media) return;
    addLayer({
      name: `${activeLayer.media.name} FX`,
      media: { ...activeLayer.media, id: crypto.randomUUID() },
      corners: activeLayer.corners.map((c) => ({ ...c })) as Corners,
      transform: { ...activeLayer.transform },
      lumaKey: activeLayer.lumaKey,
      blendMode: "screen",
    });
  };

  // la camera in uso resta selezionata anche se l'elenco non la riporta (device virtuali,
  // etichette non ancora disponibili): altrimenti la select apparirebbe vuota
  const known = devices.filter((d) => d.deviceId !== "");
  const currentId = isCamera ? (media.deviceId ?? "") : "";
  const selectable =
    currentId && !known.some((d) => d.deviceId === currentId)
      ? [{ deviceId: currentId, label: media?.name ?? "Camera" }, ...known]
      : known;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="ui-sublabel text-muted-foreground">
          Ingresso video live
        </span>
        {isCamera && (
          <span className="flex items-center gap-1 rounded bg-red-500/15 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-red-400">
            <span className="size-1.5 rounded-full bg-red-500" />
            live
          </span>
        )}
      </div>

      {!supported ? (
        <p className="text-xs text-muted-foreground">
          Questo browser non espone le camere (serve una connessione sicura: localhost o https).
        </p>
      ) : !isCamera ? (
        <Button
          variant="secondary"
          className="w-full justify-start gap-2"
          disabled={busy}
          onClick={() => activate(selectable[0]?.deviceId ?? "")}
        >
          <Video data-icon="inline-start" />
          {busy ? "Apertura camera…" : "Attiva webcam / cam"}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {selectable.length > 0 && (
            <Select value={media.deviceId ?? ""} onValueChange={(v) => void activate(v)} disabled={busy}>
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder={media.name} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {selectable.map((d) => (
                    <SelectItem key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 gap-2 px-2 text-xs" onClick={addFxLayer}>
              <Layers2 className="size-3.5 shrink-0" />
              Nuovo strato
            </Button>
            <Button
              variant="ghost"
              className="px-2"
              disabled={busy}
              onClick={() => void restart()}
              title="Riavvia la sorgente (se l'immagine si è piantata)"
            >
              <RotateCcw className="size-3.5 shrink-0" />
            </Button>
            <Button
              variant="ghost"
              className="px-2"
              onClick={() => setMedia(null)}
              title="Stacca la camera da questo layer"
            >
              <VideoOff className="size-3.5 shrink-0" />
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs leading-relaxed text-red-400">{error}</p>}

      {diag && (
        <div className="flex flex-col gap-1 rounded border border-border/60 bg-muted/30 p-2">
          <p className="text-[11px] leading-relaxed text-foreground/80">{diag.hint}</p>
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            sicuro: {diag.secure ? "sì" : "no"} · permesso: {diag.permission} · camere:{" "}
            {diag.count}
            {diag.errorName ? ` · ${diag.errorName}` : ""} · {diag.origin}
          </p>
        </div>
      )}

      {supported && !isCamera && (
        <button
          type="button"
          className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          onClick={() => void cameraDiagnostics().then(setDiag)}
        >
          Perché non si attiva?
        </button>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        La ripresa entra nel layer come un media qualsiasi: shader, palette e maschere si applicano
        come sempre. “Nuovo strato” impila un altro effetto sulla stessa camera. La finestra Output
        apre il device per conto suo, quindi va consentito l'accesso anche lì.
      </p>
    </div>
  );
}
