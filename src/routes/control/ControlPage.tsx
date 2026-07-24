import type { CSSProperties } from 'react'
import { StageCanvas } from '@/engine/StageCanvas'
import { TopToolbar } from '@/components/layout/TopToolbar'
import { SidebarResizeHandle } from '@/components/layout/SidebarResizeHandle'
import { MediaUploader } from '@/components/ControlPanel/MediaUploader'
import { OutputLauncher } from '@/components/ControlPanel/OutputLauncher'
import { ProjectsPanel } from '@/components/ControlPanel/ProjectsPanel'
import { EffectsPanel } from '@/components/EffectsLibrary/EffectsPanel'
import { EffectPresetsPanel } from '@/components/EffectsLibrary/EffectPresetsPanel'
import { PositioningPanel } from '@/components/Positioning/PositioningPanel'
import { BackgroundKeyPanel } from '@/components/Positioning/BackgroundKeyPanel'
import { MovePanel } from '@/components/Positioning/MovePanel'
import { PalettePanel } from '@/components/Palette/PalettePanel'
import { LayersPanel } from '@/components/Layers/LayersPanel'
import { CornerPinOverlay } from '@/components/Positioning/CornerPinOverlay'
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
import { useAutosave } from '@/lib/persistence'

const PANEL_TITLE: Record<string, string> = {
  layers: 'Layers',
  move: 'Move',
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
          <EffectPresetsPanel />
        </div>
      )
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
  const activePanel = useUiStore((s) => s.activePanel)
  const { width, startResize } = useResizableWidth({
    defaultWidth: 288,
    min: 240,
    max: 520,
    storageKey: 'easyvj-sidebar-width',
  })

  return (
    <SidebarProvider style={{ '--sidebar-width': `${width}px` } as CSSProperties}>
      <div className="relative flex shrink-0">
        <Sidebar>
          <SidebarHeader className="h-12 justify-center border-b border-sidebar-border px-4">
            <span className="text-sm font-semibold tracking-widest text-sidebar-foreground">
              EASY<span className="text-sidebar-foreground/60">VJ</span>
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
      <SidebarInset className="min-w-0">
        <TopToolbar />
        <main className="relative min-h-0 flex-1 overflow-hidden bg-black">
          <StageCanvas autoFit />
          <CornerPinOverlay />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
