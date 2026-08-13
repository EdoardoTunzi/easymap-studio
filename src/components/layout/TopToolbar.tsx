import { Move, Sparkles, Palette, FolderOpen, MonitorPlay, MonitorUp, Radio, PanelRight } from "lucide-react";
import { Button } from "@/components/ui/button";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUiStore, type Panel } from "@/store/uiStore";
import { useOutputStore } from "@/store/outputStore";
import { cn } from "@/lib/utils";

// Solo ciò che NON riguarda il singolo layer: contenuto, maschere e posizione del layer
// selezionato vivono nella colonna destra, tutti visibili insieme.
const NAV: { id: Panel; label: string; icon: typeof Move }[] = [
  { id: "shader", label: "Shader", icon: Sparkles },
  { id: "palette", label: "Palette", icon: Palette },
  { id: "projects", label: "Progetti", icon: FolderOpen },
  { id: "output", label: "Output", icon: MonitorPlay }
];

export function TopToolbar() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUiStore((s) => s.toggleRightSidebar);
  const live = useOutputStore((s) => s.live);
  const dirty = useOutputStore((s) => s.dirty);
  const setLive = useOutputStore((s) => s.setLive);
  const pushToOutput = useOutputStore((s) => s.pushToOutput);

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        {/* <Separator orientation="vertical" className="mx-1 h-5" /> */}
      </div>

      <nav className="flex items-center gap-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activePanel === id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setActivePanel(id)}
            className={cn("gap-1.5 text-xs uppercase tracking-wide", activePanel === id ? "text-foreground" : "text-muted-foreground")}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </nav>

      <div className="flex items-center gap-1.5">
        {/* Modalità Live: congela l'Output finché non si preme "Esegui in output" */}
        <Button
          variant={live ? "default" : "ghost"}
          size="sm"
          onClick={() => setLive(!live)}
          className={cn("gap-1.5 text-xs uppercase tracking-wide", live && "bg-red-600 text-white hover:bg-red-600/90")}
          title={live ? "Live attivo: l’Output non si aggiorna finché non premi Esegui" : "Attiva la modalità Live"}
        >
          <Radio className="size-3.5" />
          Live
        </Button>

        {live && (
          <Button
            variant={dirty ? "default" : "secondary"}
            size="sm"
            onClick={pushToOutput}
            disabled={!dirty}
            className="relative gap-1.5 text-xs"
            title="Invia lo stato corrente alla finestra Output"
          >
            <MonitorUp className="size-3.5" />
            Esegui in output
            {dirty && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-amber-400" />}
          </Button>
        )}

        {/* apre/chiude l'ispettore del layer selezionato (colonna destra) */}
        <Button
          variant={rightSidebarOpen ? "secondary" : "ghost"}
          size="icon"
          onClick={toggleRightSidebar}
          aria-pressed={rightSidebarOpen}
          className={cn(!rightSidebarOpen && "text-muted-foreground")}
          title={rightSidebarOpen ? "Nascondi il pannello del layer" : "Mostra il pannello del layer"}
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
    </header>
  );
}
