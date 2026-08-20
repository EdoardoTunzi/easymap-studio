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
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Progetti</span>
      <Button variant="secondary" onClick={openNewProjectConfirm} aria-label="Nuovo progetto">
        Nuovo Progetto
        <FilePlus2 className="size-4" />
      </Button>
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground mt-5">Salvataggio rapido</span>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Nome progetto…"
        />
        <Button size="icon" variant="secondary" onClick={handleSave} disabled={!name.trim()} aria-label="Salva progetto">
          <Save className="size-4" />
        </Button>
      </div>
      {projects.length > 0 && (
        <ul className="flex flex-col gap-1">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => loadProject(p.id)}
                className="h-8 flex-1 justify-start truncate px-2 text-sm font-normal"
                title={new Date(p.updatedAt).toLocaleString()}
              >
                {p.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(p.id)}
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Elimina ${p.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

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
