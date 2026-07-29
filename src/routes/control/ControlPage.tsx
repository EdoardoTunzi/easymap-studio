import { useRef, type CSSProperties } from 'react'
import { StageCanvas } from '@/engine/StageCanvas'
import { TopToolbar } from '@/components/layout/TopToolbar'
import { SidebarResizeHandle } from '@/components/layout/SidebarResizeHandle'
import { MediaUploader } from '@/components/ControlPanel/MediaUploader'
import { OutputLauncher } from '@/components/ControlPanel/OutputLauncher'
import { ProjectsPanel } from '@/components/ControlPanel/ProjectsPanel'
import { EffectsPanel } from '@/components/EffectsLibrary/EffectsPanel'
import { EffectPresetsPanel } from '@/components/EffectsLibrary/EffectPresetsPanel'
import { FxControlsPanel } from '@/components/EffectsLibrary/FxControlsPanel'
import { PositioningPanel } from '@/components/Positioning/PositioningPanel'
import { BackgroundKeyPanel } from '@/components/Positioning/BackgroundKeyPanel'
import { MovePanel } from '@/components/Positioning/MovePanel'
import { PalettePanel } from '@/components/Palette/PalettePanel'
import { LayersPanel } from '@/components/Layers/LayersPanel'
import { MaskPanel } from '@/components/Mask/MaskPanel'
import { MaskOverlay } from '@/components/Mask/MaskOverlay'
import { CornerPinOverlay } from '@/components/Positioning/CornerPinOverlay'
import { ViewportZoomControls, useViewportPanZoom } from '@/components/layout/ViewportZoomControls'
import { PlaylistBar } from '@/components/Playlist/PlaylistBar'
import { GenerativeLabPanel } from '@/components/Generative/GenerativeLabPanel'
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
import { useBroadcastPublisher } from '@/lib/sync'
import { useAutosave, useLoadGenerativeVisuals } from '@/lib/persistence'

const PANEL_TITLE: Record<string, string> = {
  layers: 'Layers',
  move: 'Move',
  mask: 'Mask',
  shader: 'Sliders',
  palette: 'Palette',
  assets: 'Assets',
  output: 'Output',
}

function PanelContent() {
  const activePanel = useUiStore((s) => s.activePanel)

  switch (activePanel) {
    case 'layers':
      return <LayersPanel />
    case 'move':
      return <MovePanel />
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
    case 'mask':
      return <MaskPanel />
    case 'palette':
      return <PalettePanel />
    case 'assets':
      return (
        <div className="flex flex-col gap-6">
          <MediaUploader />
          <Separator />
          <BackgroundKeyPanel />
          <Separator />
          <PositioningPanel />
          <Separator />
          <ProjectsPanel />
        </div>
      )
    case 'output':
      return <OutputLauncher />
  }
}

export function ControlPage() {
  useBroadcastPublisher()
  useAutosave()
  useLoadGenerativeVisuals()
  const activePanel = useUiStore((s) => s.activePanel)
  const generativeLabOpen = useUiStore((s) => s.generativeLabOpen)
  const overlaysVisible = useUiStore((s) => s.overlaysVisible)
  const { width, startResize } = useResizableWidth({
    defaultWidth: 288,
    min: 240,
    max: 520,
    storageKey: 'easyvj-sidebar-width',
  })
  const { width: labWidth, startResize: startLabResize } = useResizableWidth({
    defaultWidth: 340,
    min: 280,
    max: 640,
    storageKey: 'easyvj-generative-width',
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
          {overlaysVisible && (activePanel === 'mask' ? <MaskOverlay /> : <CornerPinOverlay />)}
          <ViewportZoomControls />
        </main>
        <PlaylistBar />
      </SidebarInset>
      {generativeLabOpen && (
        <aside
          // min-w-0 + overflow-hidden: senza, il codice GLSL a righe lunghe dell'editor
          // allargherebbe il pannello oltre la larghezza impostata (min-width:auto dei flex item)
          className="relative h-svh min-w-0 shrink-0 overflow-hidden border-l border-sidebar-border"
          style={{ width: labWidth }}
        >
          <div
            onPointerDown={startLabResize}
            role="separator"
            aria-orientation="vertical"
            className="absolute inset-y-0 -left-1 z-30 w-2 cursor-col-resize touch-none select-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors hover:after:bg-sidebar-ring active:after:bg-sidebar-ring"
          />
          <GenerativeLabPanel />
        </aside>
      )}
    </SidebarProvider>
  )
}
