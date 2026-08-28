import { useRef, type CSSProperties } from "react";
import { StageCanvas } from "@/engine/StageCanvas";
import { TopToolbar } from "@/components/layout/TopToolbar";
import { SidebarResizeHandle } from "@/components/layout/SidebarResizeHandle";
import { OutputLauncher } from "@/components/ControlPanel/OutputLauncher";
import { ProjectsPanel } from "@/components/ControlPanel/ProjectsPanel";
import { EffectsPanel } from "@/components/EffectsLibrary/EffectsPanel";
import { EffectPresetsPanel } from "@/components/EffectsLibrary/EffectPresetsPanel";
import { FxControlsPanel } from "@/components/EffectsLibrary/FxControlsPanel";
import { PalettePanel } from "@/components/Palette/PalettePanel";
import { LayerInspector } from "@/components/Layers/LayerInspector";
import { CollapsibleSection } from "@/components/Layers/CollapsibleSection";
import { MaskOverlay } from "@/components/Mask/MaskOverlay";
import { CornerPinOverlay } from "@/components/Positioning/CornerPinOverlay";
import { AlignmentGrid } from "@/components/Positioning/AlignmentGrid";
import { MappingControls } from "@/components/Positioning/MappingControls";
import { ViewportZoomControls, useViewportPanZoom } from "@/components/layout/ViewportZoomControls";
import { PlaylistBar } from "@/components/Playlist/PlaylistBar";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useResizableWidth } from "@/hooks/use-resizable-width";
import { useEffectHotkeys } from "@/hooks/use-effect-hotkeys";
import { useOutputHotkeys } from "@/hooks/use-output-hotkeys";
import { usePaletteLoop } from "@/hooks/use-palette-loop";
import { useUiStore } from "@/store/uiStore";
import { useScrollShadow } from "@/hooks/use-scroll-shadow";
import { useLayersStore } from "@/store/layersStore";
import { useBroadcastPublisher } from "@/lib/sync";
import { useAutosave } from "@/lib/persistence";

// §16 (Wayfinding + label dirette): il titolo dice cosa c'è dentro il pannello, non che forma
// hanno i controlli — "Sliders" descriveva il widget, non il contenuto.
const PANEL_TITLE: Record<string, string> = {
  shader: "Effetti",
  palette: "Palette",
  projects: "Progetti",
  output: "Output"
};

function PanelContent() {
  const activePanel = useUiStore((s) => s.activePanel);

  switch (activePanel) {
    case "shader":
      return (
        <div className="flex flex-col gap-6">
          <EffectsPanel />
          {/* -mx-4: annulla il padding orizzontale del wrapper p-4 del pannello (sotto), che
              altrimenti si sommerebbe al px-4 interno di CollapsibleSection — lo stesso
              componente della colonna destra, dove vive in un contenitore senza padding proprio
              e quindi non ha questo problema. Le due sezioni tornano ad allinearsi sotto
              "EFFETTO"/"COLORI CASUALI" invece di un livello più a destra.
              border-t: unico divisorio verso gli sliders sopra — niente <Separator /> qui,
              altrimenti si vedrebbero due righe vicine (la Separator e questo bordo). Fra le due
              sezioni il divisorio è il border-b di CollapsibleSection stesso. */}
          <div className="-mx-4 border-t border-sidebar-border/60">
            <CollapsibleSection section="fxControls" title="Controlli globali">
              <FxControlsPanel />
            </CollapsibleSection>
            <CollapsibleSection section="effectPresets" title="Preset salvati">
              <EffectPresetsPanel />
            </CollapsibleSection>
          </div>
        </div>
      );
    case "palette":
      return <PalettePanel />;
    case "projects":
      return <ProjectsPanel />;
    case "output":
      return <OutputLauncher />;
  }
}

export function ControlPage() {
  useBroadcastPublisher();
  useAutosave();
  useEffectHotkeys();
  useOutputHotkeys();
  // il motore del loop palette sta qui e non nel pannello: i pannelli si smontano al cambio tab
  usePaletteLoop();
  const activePanel = useUiStore((s) => s.activePanel);
  const overlaysVisible = useUiStore((s) => s.overlaysVisible);
  const gridVisible = useUiStore((s) => s.gridVisible);
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen);
  const setRightSidebarOpen = useUiStore((s) => s.setRightSidebarOpen);
  // le maniglie delle maschere sostituiscono il corner-pin solo mentre se ne sta modificando una:
  // la maschera deve esistere davvero sul layer attivo, altrimenti il corner-pin resterebbe nascosto
  // dietro un MaskOverlay vuoto (selezione rimasta appesa a un altro layer)
  const editingMask = useLayersStore((s) => {
    if (s.activeMaskId == null) return false;
    const active = s.layers.find((l) => l.id === s.activeLayerId);
    return active?.masks.some((m) => m.id === s.activeMaskId) ?? false;
  });
  const { width, startResize } = useResizableWidth({
    defaultWidth: 288,
    min: 240,
    max: 520,
    storageKey: "easyvj-sidebar-width"
  });
  const { width: inspectorWidth, startResize: startInspectorResize } = useResizableWidth({
    defaultWidth: 320,
    min: 260,
    max: 560,
    storageKey: "easyvj-inspector-width",
    edge: "right"
  });
  const stageRef = useRef<HTMLDivElement>(null);
  useViewportPanZoom(stageRef);
  const panelScroll = useScrollShadow<HTMLDivElement>();

  return (
    <SidebarProvider style={{ "--sidebar-width": `${width}px` } as CSSProperties}>
      <div className="relative flex shrink-0">
        <Sidebar>
          <SidebarHeader className="h-12 flex-row items-center gap-2 border-b border-sidebar-border px-4">
            <img src="/logo.png" alt="" className="size-6 shrink-0 rounded object-cover" />
            <span className="truncate text-sm font-semibold tracking-widest text-sidebar-foreground">
              EASYMAP<span className="text-sidebar-foreground/60"> STUDIO</span>
            </span>
          </SidebarHeader>
          <SidebarContent>
            {/* Stesso maiuscoletto, stesso sfondo e stesso testo centrato del titolo della
                colonna destra: due colonne che si somigliano devono scriversi uguale. */}
            <div className="flex shrink-0 justify-center border-b border-sidebar-border bg-secondary/40 py-4.5">
              <span className="ui-eyebrow text-muted-foreground">{PANEL_TITLE[activePanel]}</span>
            </div>
            {/* min-w-0 + w-full: il Viewport di Radix ScrollArea è `display: table` e si
                dimensionerebbe sul max-content, sfondando la sidebar quando la si stringe */}
            <div ref={panelScroll.ref} className="relative min-h-0 w-full min-w-0 flex-1">
              {/* §12: la sfumatura vive sopra il contenuto e compare solo a scorrimento iniziato,
                  al posto di un bordo fisso che c'è anche quando non nasconde niente. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-linear-to-b from-sidebar to-transparent transition-opacity duration-[--dur-base] ease-[--ease-out]"
                style={{ opacity: panelScroll.scrolled ? 1 : 0 }}
              />
              <ScrollArea className="h-full border-t border-sidebar-border/60">
                <div className="p-4">
                  <PanelContent />
                </div>
              </ScrollArea>
            </div>
          </SidebarContent>
        </Sidebar>
        <SidebarResizeHandle onPointerDown={startResize} side="right" />
      </div>
      {/* h-svh: altezza bloccata al viewport, così alzando la barra playlist è il canvas a comprimersi */}
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <TopToolbar />
        <main ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <StageCanvas autoFit controlView role="control" />
          {/* la griglia sta sotto le maniglie e segue lo stesso toggle degli altri riferimenti */}
          {overlaysVisible && gridVisible && <AlignmentGrid />}
          {overlaysVisible && (editingMask ? <MaskOverlay /> : <CornerPinOverlay />)}
          <MappingControls />
          <ViewportZoomControls />
        </main>
        <PlaylistBar />
      </SidebarInset>
      {/* Colonna destra: stesso componente della sinistra, così scivola invece di sparire di
          colpo e porta gli stessi data-state/data-side. Serve un secondo SidebarProvider perché
          il context ne regge una sola, ed è controllato dallo store: il pulsante in TopToolbar
          resta la fonte di verità. `keyboardShortcut={false}` lascia ⌘B alla sola colonna
          sinistra, `cookieName` evita che i due provider si sovrascrivano lo stato a vicenda.
          w-auto: il wrapper del provider è `w-full`, che in questa riga flex prenderebbe tutto. */}
      <SidebarProvider
        open={rightSidebarOpen}
        onOpenChange={setRightSidebarOpen}
        keyboardShortcut={false}
        cookieName="inspector_state"
        className="w-auto min-h-0"
        style={{ "--sidebar-width": `${inspectorWidth}px` } as CSSProperties}
      >
        <Sidebar side="right">
          <SidebarResizeHandle onPointerDown={startInspectorResize} side="left" />
          {/* Simmetrico all'header della colonna sinistra: stessa h-12 del logo e della TopToolbar,
              così le tre fasce in cima chiudono sulla stessa riga (prima erano 49px contro 48 e il
              bordo cadeva un pixel più in basso). p-0 e items-center annullano il `p-2 gap-2` del
              componente, che qui centrerebbe male un titolo su riga singola. */}
          <SidebarHeader className="h-12 shrink-0 items-center justify-center border-b border-sidebar-border bg-secondary/40 p-0">
            <span className="ui-eyebrow text-muted-foreground">Layer Inspector</span>
          </SidebarHeader>
          {/* overflow-hidden: lo scorrimento lo governa la ScrollArea dentro LayerInspector,
              il contenitore non deve aggiungerne un secondo */}
          <SidebarContent className="overflow-hidden">
            <LayerInspector />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </SidebarProvider>
  );
}
