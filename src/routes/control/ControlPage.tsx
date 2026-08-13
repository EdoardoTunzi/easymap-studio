import { useRef, type CSSProperties } from 'react'
import { StageCanvas } from '@/engine/StageCanvas'
import { TopToolbar } from '@/components/layout/TopToolbar'
import { SidebarResizeHandle } from '@/components/layout/SidebarResizeHandle'
import { OutputLauncher } from '@/components/ControlPanel/OutputLauncher'
import { ProjectsPanel } from '@/components/ControlPanel/ProjectsPanel'
import { EffectsPanel } from '@/components/EffectsLibrary/EffectsPanel'
import { EffectPresetsPanel } from '@/components/EffectsLibrary/EffectPresetsPanel'
import { FxControlsPanel } from '@/components/EffectsLibrary/FxControlsPanel'
import { PalettePanel } from '@/components/Palette/PalettePanel'
import { LayerInspector } from '@/components/Layers/LayerInspector'
import { MaskOverlay } from '@/components/Mask/MaskOverlay'
import { CornerPinOverlay } from '@/components/Positioning/CornerPinOverlay'
import { AlignmentGrid } from '@/components/Positioning/AlignmentGrid'
import { MappingControls } from '@/components/Positioning/MappingControls'
import { ViewportZoomControls, useViewportPanZoom } from '@/components/layout/ViewportZoomControls'
import { PlaylistBar } from '@/components/Playlist/PlaylistBar'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
} from '@/components/ui/sidebar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useResizableWidth } from '@/hooks/use-resizable-width'
import { useUiStore } from '@/store/uiStore'
import { useLayersStore } from '@/store/layersStore'
import { useBroadcastPublisher } from '@/lib/sync'
import { useAutosave } from '@/lib/persistence'

const PANEL_TITLE: Record<string, string> = {
  shader: 'Sliders',
  palette: 'Palette',
  projects: 'Progetti',
  output: 'Output',
}

function PanelContent() {
  const activePanel = useUiStore((s) => s.activePanel)

  switch (activePanel) {
    case 'shader':
      return (
        <div className="flex flex-col gap-6">
          <EffectsPanel />
          <Separator />
          <FxControlsPanel />
          <Separator />
          <EffectPresetsPanel />
        </div>
      )
    case 'palette':
      return <PalettePanel />
    case 'projects':
      return <ProjectsPanel />
    case 'output':
      return <OutputLauncher />
  }
}

export function ControlPage() {
  useBroadcastPublisher()
  useAutosave()
  const activePanel = useUiStore((s) => s.activePanel)
  const overlaysVisible = useUiStore((s) => s.overlaysVisible)
  const gridVisible = useUiStore((s) => s.gridVisible)
  const rightSidebarOpen = useUiStore((s) => s.rightSidebarOpen)
  // le maniglie delle maschere sostituiscono il corner-pin solo mentre se ne sta modificando una
  const editingMask = useLayersStore((s) => s.activeMaskId != null)
  const { width, startResize } = useResizableWidth({
    defaultWidth: 288,
    min: 240,
    max: 520,
    storageKey: 'easyvj-sidebar-width',
  })
  const { width: inspectorWidth, startResize: startInspectorResize } = useResizableWidth({
    defaultWidth: 320,
    min: 260,
    max: 560,
    storageKey: 'easyvj-inspector-width',
    edge: 'right',
  })
  const stageRef = useRef<HTMLDivElement>(null)
  useViewportPanZoom(stageRef)

  return (
    <SidebarProvider style={{ '--sidebar-width': `${width}px` } as CSSProperties}>
      <div className="relative flex shrink-0">
        <Sidebar>
          <SidebarHeader className="h-12 flex-row items-center gap-2 border-b border-sidebar-border px-4">
            <img src="/logo.png" alt="" className="size-6 shrink-0 rounded object-cover" />
            <span className="truncate text-sm font-semibold tracking-widest text-sidebar-foreground">
              EASYMAP<span className="text-sidebar-foreground/60"> STUDIO</span>
            </span>
          </SidebarHeader>
          <SidebarContent>
            <div className="flex h-9 shrink-0 items-center border-b border-sidebar-border px-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
                {PANEL_TITLE[activePanel]}
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4">
                <PanelContent />
              </div>
            </ScrollArea>
          </SidebarContent>
        </Sidebar>
        <SidebarResizeHandle onPointerDown={startResize} />
      </div>
      {/* h-svh: altezza bloccata al viewport, così alzando la barra playlist è il canvas a comprimersi */}
      <SidebarInset className="h-svh min-w-0 overflow-hidden">
        <TopToolbar />
        <main ref={stageRef} className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <StageCanvas autoFit controlView />
          {/* la griglia sta sotto le maniglie e segue lo stesso toggle degli altri riferimenti */}
          {overlaysVisible && gridVisible && <AlignmentGrid />}
          {overlaysVisible && (editingMask ? <MaskOverlay /> : <CornerPinOverlay />)}
          <MappingControls />
          <ViewportZoomControls />
        </main>
        <PlaylistBar />
      </SidebarInset>
      {rightSidebarOpen && (
        // min-w-0 + overflow-hidden: senza, i contenuti larghi allargherebbero il pannello
        // oltre la larghezza impostata (i flex item hanno min-width: auto)
        <aside
          className="relative h-svh min-w-0 shrink-0 overflow-hidden border-l border-sidebar-border bg-sidebar"
          style={{ width: inspectorWidth }}
        >
          <div
            onPointerDown={startInspectorResize}
            role="separator"
            aria-orientation="vertical"
            className="absolute inset-y-0 -left-1 z-30 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-sidebar-ring active:after:bg-sidebar-ring"
          />
          <LayerInspector />
        </aside>
      )}
    </SidebarProvider>
  )
}
