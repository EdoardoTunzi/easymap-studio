import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Save, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  saveEffectPreset,
  loadEffectPreset,
  deleteEffectPreset,
  listEffectPresets,
  exportPresetToFile,
  exportPresetsToFile,
  importFromJson,
  type EffectPreset
} from "@/lib/persistence";
import { ProjectFileError, detectFileKind, projectFileName } from "@/lib/projectFile";
import { downloadBlob } from "@/lib/download";

export function EffectPresetsPanel() {
  const [presets, setPresets] = useState<EffectPreset[]>([]);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  /** Preset in attesa di conferma di eliminazione; `null` = nessun dialogo aperto. */
  const [pendingDelete, setPendingDelete] = useState<EffectPreset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    setPresets(await listEffectPresets());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveEffectPreset(trimmed);
    setName("");
    refresh();
  };

  const handleDelete = async (id: string) => {
    await deleteEffectPreset(id);
    setPendingDelete(null);
    refresh();
  };

  /** Esporta un solo preset, per condividerne uno senza spedire tutta la libreria. */
  const handleExportOne = async (preset: EffectPreset) => {
    setStatus(null);
    const result = await exportPresetToFile(preset.id);
    if (!result) {
      setStatus({ kind: "error", text: "Preset non trovato." });
      return;
    }
    downloadBlob(projectFileName(result.name, "easymap-preset"), result.blob);
    setStatus({ kind: "ok", text: `“${result.name}” esportato.` });
  };

  /** Esporta l'intera libreria in un file suo: i preset sono globali, non appartengono a un progetto. */
  const handleExportAll = async () => {
    setStatus(null);
    const result = await exportPresetsToFile();
    if (!result) {
      setStatus({ kind: "error", text: "Non c'è ancora nessun preset da esportare." });
      return;
    }
    downloadBlob(projectFileName("preset", "easymap-preset"), result.blob);
    setStatus({ kind: "ok", text: `${result.count} preset esportati.` });
  };

  const handleImportFile = async (file: File) => {
    setStatus(null);
    try {
      const text = await file.text();
      // il tipo si controlla PRIMA di importare: qui un progetto non deve entrare di straforo fra
      // quelli salvati mentre il messaggio dice di usare l'altro pannello
      if (detectFileKind(text) === "project") {
        setStatus({ kind: "error", text: "Questo è un progetto: importalo dal pannello Progetti." });
        return;
      }
      const result = await importFromJson(text);
      if (result.kind !== "presets") return;
      await refresh();
      setStatus({
        kind: "ok",
        text: `${result.imported} preset importati${result.skipped > 0 ? `, ${result.skipped} già in libreria` : ""}.`,
      });
    } catch (err) {
      setStatus({
        kind: "error",
        text: err instanceof ProjectFileError ? err.message : "Importazione non riuscita.",
      });
    }
  };

  return (
    // il titolo "Preset salvati" lo mette il CollapsibleSection che lo ospita
    <div className="flex flex-col gap-2">
      {/* La libreria è globale, quindi ha un file suo invece di viaggiare dentro i progetti:
          aprire la scena di qualcun altro non deve riempirti l'elenco dei suoi preset. */}
      <div className="flex gap-2">
        <Button variant="outline" size="xs" className="press flex-1" onClick={() => fileInputRef.current?.click()}>
          <Upload data-icon="inline-start" />
          Importa
        </Button>
        <Button variant="outline" size="xs" className="press flex-1" onClick={handleExportAll} disabled={presets.length === 0}>
          <Download data-icon="inline-start" />
          Esporta tutti
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
      {status && (
        <p className={`ui-sublabel leading-relaxed ${status.kind === "error" ? "text-destructive" : "text-muted-foreground/80"}`} role="status">
          {status.text}
        </p>
      )}

      <span className="ui-sublabel mb-1 px-1.5 text-muted-foreground">Salva preset:</span>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="Nome preset…"
          className="h-8"
        />
        <Button variant="default" onClick={handleSave} disabled={!name.trim()} aria-label="Salva preset">
          <Save />
        </Button>
      </div>

      {presets.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {presets.map((p) => (
            // group/row: le azioni restano attenuate finché il puntatore non entra nella riga
            <li key={p.id} className="group/row flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => loadEffectPreset(p.id)}
                className="press min-w-0 flex-1 justify-start px-2 font-normal"
                title={`${p.shaderName} · ${new Date(p.updatedAt).toLocaleString()}`}
              >
                <span className="truncate">{p.name}</span>
                <span className="ui-value shrink-0 text-[11px] text-muted-foreground/60">–</span>
                <span className="ui-value min-w-0 truncate text-[11px] text-muted-foreground/80">{p.shaderName}</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleExportOne(p)}
                className="row-action press size-8 shrink-0 text-muted-foreground"
                aria-label={`Esporta ${p.name}`}
                title={`Scarica “${p.name}” come file`}
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
          Trova impostazioni che ti piacciono (shader, parametri, size, palette), dai un nome e salvale: potrai riapplicarle su qualsiasi progetto.
        </p>
      )}

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        itemName={pendingDelete?.name ?? ""}
        description="Il preset viene eliminato dalla libreria. I layer e i progetti che ne usano le impostazioni non cambiano."
        onConfirm={() => pendingDelete && handleDelete(pendingDelete.id)}
      />
    </div>
  );
}
