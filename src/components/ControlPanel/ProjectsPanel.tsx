import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FilePlus2, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  newProject,
  exportProjectToFile,
  exportCurrentSceneToFile,
  importFromJson,
  type StoredProject
} from "@/lib/persistence";
import { ProjectFileError, projectFileName, type ExportProgress } from "@/lib/projectFile";
import { downloadBlob } from "@/lib/download";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";

type ProjectListItem = Omit<StoredProject, "layers">;

/** Esito dell'ultima operazione su file, mostrato sotto i pulsanti (non c'è un sistema di toast). */
type FileStatus = { kind: "ok" | "error"; text: string } | null;

const formatMb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

export function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [fileStatus, setFileStatus] = useState<FileStatus>(null);
  /** Progetto in attesa di conferma di eliminazione; `null` = nessun dialogo aperto. */
  const [pendingDelete, setPendingDelete] = useState<ProjectListItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /**
   * Esporta, con l'attesa segnalata: il JSON di un progetto con dei video si costruisce tutto in
   * memoria (base64 compreso) e può prendere qualche secondo, durante il quale senza un segnale
   * il pulsante sembrerebbe non aver fatto nulla.
   */
  const runExport = async (
    label: string,
    produce: (onProgress: (p: ExportProgress) => void) => Promise<Blob | null>,
  ) => {
    setBusy(true);
    setFileStatus(null);
    setProgress(null);
    try {
      const blob = await produce(setProgress);
      if (blob == null) {
        setFileStatus({ kind: "error", text: "Progetto non trovato." });
        return;
      }
      downloadBlob(projectFileName(label), blob);
      setFileStatus({ kind: "ok", text: `“${label}” esportato (${formatMb(blob.size)}).` });
    } catch (err) {
      setFileStatus({
        kind: "error",
        text: err instanceof ProjectFileError ? err.message : "Esportazione non riuscita.",
      });
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const handleImportFile = async (file: File) => {
    setBusy(true);
    setFileStatus(null);
    try {
      // in entrambi i casi si AGGIUNGE: un progetto va in lista senza aprirsi (aprirlo d'ufficio
      // farebbe perdere il lavoro non salvato), i preset si uniscono a quelli già in libreria
      const result = await importFromJson(await file.text());
      await refresh();
      setFileStatus({
        kind: "ok",
        text:
          result.kind === "project"
            ? `“${result.name}” importato: aprilo dalla lista qui sotto.`
            : `${result.imported} preset importati${result.skipped > 0 ? `, ${result.skipped} già in libreria` : ""}.`,
      });
    } catch (err) {
      setFileStatus({
        kind: "error",
        text: err instanceof ProjectFileError ? err.message : "Importazione non riuscita.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveProject(trimmed);
    setName("");
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setPendingDelete(null);
    refresh();
  };

  const openNewProjectConfirm = () => {
    setNewName(name);
    setConfirmOpen(true);
  };

  const handleSaveAndNew = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    await saveProject(trimmed);
    setName("");
    refresh();
    newProject();
    setConfirmOpen(false);
  };

  const handleDiscardAndNew = () => {
    newProject();
    setConfirmOpen(false);
  };

  return (
    // Il titolo "Progetti" lo dice già l'intestazione del pannello: qui restano solo i tre gruppi
    // (crea, salva, riapri), separati dallo spazio invece che da etichette ripetute (§16).
    <div className="flex flex-col gap-5">
      <Button variant="secondary" onClick={openNewProjectConfirm} aria-label="Nuovo progetto" className="press w-full justify-between">
        Nuovo progetto
        <FilePlus2 data-icon="inline-end" />
      </Button>

      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">Salvataggio rapido</span>
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            placeholder="Nome progetto…"
            className="h-8"
          />
          <Button size="icon" variant="secondary" onClick={handleSave} disabled={!name.trim()} aria-label="Salva progetto" className="press size-8">
            <Save className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">File</span>
        <div className="flex gap-2">
          {/* Esporta la scena com'è ADESSO, senza obbligare a salvarla prima fra i progetti: è il
              caso più frequente ("me lo porto via") e passare dal salvataggio sarebbe un passaggio
              in più per un file che poi vive per conto suo. */}
          <Button
            variant="secondary"
            className="press flex-1 justify-between"
            disabled={busy}
            onClick={() => runExport(name.trim() || "Scena", (p) => exportCurrentSceneToFile(name.trim() || "Scena", p))}
            title="Scarica la scena attuale come file .easymap.json, asset inclusi"
          >
            Esporta
            <Download data-icon="inline-end" />
          </Button>
          <Button
            variant="secondary"
            className="press flex-1 justify-between"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            title="Apri un file .easymap.json e aggiungilo ai progetti salvati"
          >
            Importa
            <Upload data-icon="inline-end" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              // si azzera sempre: riselezionare lo STESSO file non emetterebbe un altro change
              e.target.value = "";
              if (file) handleImportFile(file);
            }}
          />
        </div>
        {/* Avanzamento: un progetto con dei video richiede secondi, e un pulsante che si limita a
            spegnersi non distingue "sto lavorando" da "si è piantato". La percentuale è sui byte
            degli asset, che è dove va davvero il tempo. */}
        {progress && (
          <div className="flex flex-col gap-1" role="status" aria-live="polite">
            <div className="flex items-baseline justify-between gap-2">
              <span className="ui-sublabel text-muted-foreground">
                {progress.phase === "assets" ? "Conversione asset…" : "Scrittura del file…"}
              </span>
              <span className="ui-value tabular-nums text-[11px] text-muted-foreground/80">
                {progress.total > 0 ? `${Math.round((progress.done / progress.total) * 100)}%` : ""}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-[--dur-fast] ease-[--ease-out]"
                style={{ width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 100}%` }}
              />
            </div>
          </div>
        )}
        {fileStatus && !progress && (
          <p className={`ui-sublabel leading-relaxed ${fileStatus.kind === "error" ? "text-destructive" : "text-muted-foreground/80"}`} role="status">
            {fileStatus.text}
          </p>
        )}
        <p className="ui-sublabel leading-relaxed text-muted-foreground/80">
          Il file contiene la scena e i suoi asset, quindi si riapre su un altro computer. Le cartelle
          delle playlist di contenuti restano fuori: di quelle si esporta il nome, e vanno ricollegate.
          “Importa” accetta anche un file di preset.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="ui-eyebrow text-muted-foreground">Progetti salvati</span>
        {projects.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {projects.map((p) => (
              // group/row: il cestino resta attenuato finché il puntatore non entra nella riga
              <li key={p.id} className="group/row flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={() => loadProject(p.id)}
                  className="press min-w-0 flex-1 justify-start px-2 font-normal"
                  title={`Aperto l'ultima volta: ${new Date(p.updatedAt).toLocaleString()}`}
                >
                  <span className="truncate">{p.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy}
                  onClick={() => runExport(p.name, (onProgress) => exportProjectToFile(p.id, onProgress))}
                  className="row-action press size-8 shrink-0 text-muted-foreground"
                  aria-label={`Esporta ${p.name}`}
                  title={`Scarica “${p.name}” come file, asset inclusi`}
                >
                  <Download />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(p)}
                  className="row-action press size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Elimina ${p.name}`}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ui-sublabel leading-relaxed text-muted-foreground/80">
            Nessun progetto salvato. Dai un nome qui sopra e premi il dischetto: il lavoro resta su questo
            computer e si riapre da questa lista.
          </p>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        itemName={pendingDelete?.name ?? ""}
        description="Il progetto viene eliminato da questo computer. Se ne hai esportato un file, quello resta dov'è."
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
      />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nuovo progetto</AlertDialogTitle>
            <AlertDialogDescription>
              Il progetto attuale verrà sostituito da uno nuovo con un solo layer vuoto. Vuoi salvarlo prima di procedere?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveAndNew();
            }}
            placeholder="Nome progetto…"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDiscardAndNew}>
              Non salvare
            </Button>
            <Button onClick={handleSaveAndNew} disabled={!newName.trim()}>
              Salva e nuovo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
