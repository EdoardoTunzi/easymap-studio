import { useCallback, useEffect, useState } from "react";
import { Bookmark, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveEffectPreset, loadEffectPreset, deleteEffectPreset, listEffectPresets, type EffectPreset } from "@/lib/persistence";

export function EffectPresetsPanel() {
  const [presets, setPresets] = useState<EffectPreset[]>([]);
  const [name, setName] = useState("");

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
    refresh();
  };

  return (
    // il titolo "Preset salvati" lo mette il CollapsibleSection che lo ospita
    <div className="flex flex-col gap-2">
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
        <Button variant="default" onClick={handleSave} disabled={!name.trim()} aria-label="Salva preset" className="">
          <Save className=" size-4" />
        </Button>
      </div>
      {presets.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {presets.map((p) => (
            <li key={p.id} className="group/row flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => loadEffectPreset(p.id)}
                className="press h-8 min-w-0 flex-1 justify-start px-2 text-sm font-normal"
                title={`${p.shaderName} · ${new Date(p.updatedAt).toLocaleString()}`}
              >
                <span className="truncate">{p.name}</span>
                <span className="ui-value ml-auto max-w-[45%] shrink-0 truncate pl-2 text-[11px] text-muted-foreground/80">{p.shaderName}</span>
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
          Trova impostazioni che ti piacciono (shader, parametri, size, palette), dai un nome e salvale: potrai riapplicarle su qualsiasi progetto.
        </p>
      )}
    </div>
  );
}
