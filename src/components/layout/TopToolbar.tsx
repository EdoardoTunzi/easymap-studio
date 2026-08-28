import { Move, Sparkles, Palette, FolderOpen, ListVideo, MonitorPlay, MonitorUp, Radio, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUiStore, type Panel } from "@/store/uiStore";
import { useOutputStore } from "@/store/outputStore";
import { cn } from "@/lib/utils";

// Solo ciò che NON riguarda il singolo layer: contenuto, maschere e posizione del layer
// selezionato vivono nella colonna destra, tutti visibili insieme.
type NavItem = { id: Panel; label: string; icon: typeof Move };

// Il toggle della playlist si infila tra "Progetti" e "Output": non è un pannello della
// sidebar, quindi la nav è spezzata in due gruppi con il bottone in mezzo.
const NAV_BEFORE_PLAYLIST: NavItem[] = [
  { id: "shader", label: "Effetti", icon: Sparkles },
  { id: "palette", label: "Palette", icon: Palette },
  { id: "projects", label: "Progetti", icon: FolderOpen }
];

const NAV_AFTER_PLAYLIST: NavItem[] = [{ id: "output", label: "Output", icon: MonitorPlay }];

/**
 * Sotto una certa larghezza le etichette della nav spariscono e restano le sole icone: la toolbar
 * andava in overflow e l'ultimo pulsante (quello che apre la colonna destra) finiva sotto la
 * sidebar, irraggiungibile. Le sole icone liberano 310px.
 *
 * La soglia è sulla larghezza della **toolbar**, non della finestra (`@container` sull'header):
 * lo spazio utile cambia anche aprendo o chiudendo le due colonne a finestra ferma, e una media
 * query non se ne accorgerebbe. Due valori perché in modalità Live compare anche "Esegui in
 * output", che da solo vale quanto due pulsanti della nav.
 */
const NAV_LABEL = '@max-[660px]:hidden'
const NAV_LABEL_LIVE = '@max-[860px]:hidden'

export function TopToolbar() {
  const activePanel = useUiStore((s) => s.activePanel);
  const setActivePanel = useUiStore((s) => s.setActivePanel);
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  const toggleRightSidebar = useUiStore((s) => s.toggleRightSidebar);
  const live = useOutputStore((s) => s.live);
  const dirty = useOutputStore((s) => s.dirty);
  const setLive = useOutputStore((s) => s.setLive);
  const pushToOutput = useOutputStore((s) => s.pushToOutput);
  const playlistVisible = useUiStore((s) => s.playlistVisible);
  const togglePlaylist = useUiStore((s) => s.togglePlaylist);

  // niente `data-icon` sui pulsanti della nav: serve al padding asimmetrico fra icona e testo, ma
  // qui il testo sparisce sotto soglia e lascerebbe l'icona fuori centro. Il `px` simmetrico del
  // variant la tiene centrata in entrambi gli stati.
  const navLabel = live ? NAV_LABEL_LIVE : NAV_LABEL;

  const renderPanelButton = ({ id, label, icon: Icon }: NavItem) => (
    <Button
      key={id}
      variant={activePanel === id ? "secondary" : "ghost"}
      size="sm"
      onClick={() => setActivePanel(id)}
      title={label}
      className={cn("gap-1.5 uppercase tracking-wide", activePanel === id ? "text-foreground" : "text-muted-foreground")}
    >
      <Icon />
      <span className={navLabel}>{label}</span>
    </Button>
  );

  return (
    <header className="@container flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        {/* <Separator orientation="vertical" className="mx-1 h-5" /> */}
      </div>

      <nav className="flex items-center gap-1">
        {NAV_BEFORE_PLAYLIST.map(renderPanelButton)}
        <Button
          variant={playlistVisible ? "secondary" : "ghost"}
          size="sm"
          onClick={togglePlaylist}
          aria-pressed={playlistVisible}
          title={playlistVisible ? "Nascondi la barra playlist" : "Mostra la barra playlist"}
          className={cn("gap-1.5 uppercase tracking-wide", playlistVisible ? "text-foreground" : "text-muted-foreground")}
        >
          <ListVideo />
          <span className={navLabel}>Playlist</span>
        </Button>
        {NAV_AFTER_PLAYLIST.map(renderPanelButton)}
      </nav>

      <div className="flex items-center gap-1.5">
        {/* Modalità Live: congela l'Output finché non si preme "Esegui in output" */}
        <Button
          variant={live ? "default" : "ghost"}
          size="sm"
          onClick={() => setLive(!live)}
          className={cn("gap-1.5 uppercase tracking-wide", live && "bg-red-600 text-white hover:bg-red-600/90")}
          title={live ? "Live attivo: l’Output non si aggiorna finché non premi Esegui" : "Attiva la modalità Live"}
        >
          <Radio data-icon="inline-start" />
          Live
        </Button>

        {live && (
          <Button
            variant={dirty ? "default" : "secondary"}
            size="sm"
            onClick={pushToOutput}
            disabled={!dirty}
            className="relative gap-1.5"
            title="Invia lo stato corrente alla finestra Output (Spazio)"
          >
            <MonitorUp data-icon="inline-start" />
            Esegui in output
            <kbd className="ml-0.5 rounded border border-current/30 px-1 text-[10px] leading-4 opacity-70">Spazio</kbd>
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
          <Layers />
        </Button>
      </div>
    </header>
  );
}
