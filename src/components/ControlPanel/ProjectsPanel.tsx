import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Save, Trash2 } from "lucide-react";
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
import { saveProject, loadProject, deleteProject, listProjects, newProject, type StoredProject } from "@/lib/persistence";

type ProjectListItem = Omit<StoredProject, "layers">;

export function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [name, setName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveProject(trimmed);
    setName("");
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
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
        <FilePlus2 className="size-4" />
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
        <span className="ui-eyebrow text-muted-foreground">Progetti salvati</span>
        {projects.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {projects.map((p) => (
              // group/row: il cestino resta attenuato finché il puntatore non entra nella riga
              <li key={p.id} className="group/row flex items-center gap-1">
                <Button
                  variant="ghost"
                  onClick={() => loadProject(p.id)}
                  className="press h-8 min-w-0 flex-1 justify-start px-2 text-sm font-normal"
                  title={`Aperto l'ultima volta: ${new Date(p.updatedAt).toLocaleString()}`}
                >
                  <span className="truncate">{p.name}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(p.id)}
                  className="row-action press size-8 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Elimina ${p.name}`}
                >
                  <Trash2 className="size-4" />
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
