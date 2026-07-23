import { StageCanvas } from '@/engine/StageCanvas'
import { TopToolbar } from '@/components/layout/TopToolbar'
import { MediaUploader } from '@/components/ControlPanel/MediaUploader'
import { OutputLauncher } from '@/components/ControlPanel/OutputLauncher'
import { ProjectsPanel } from '@/components/ControlPanel/ProjectsPanel'
import { EffectsPanel } from '@/components/EffectsLibrary/EffectsPanel'
import { PositioningPanel } from '@/components/Positioning/PositioningPanel'
import { BackgroundKeyPanel } from '@/components/Positioning/BackgroundKeyPanel'
import { MovePanel } from '@/components/Positioning/MovePanel'
import { CornerPinOverlay } from '@/components/Positioning/CornerPinOverlay'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useUiStore } from '@/store/uiStore'
import { useBroadcastPublisher } from '@/lib/sync'
import { useAutosave } from '@/lib/persistence'

const PANEL_TITLE: Record<string, string> = {
  move: 'Move',
  shader: 'Sliders',
  assets: 'Assets',
  output: 'Output',
}

function PanelContent() {
  const activePanel = useUiStore((s) => s.activePanel)

  switch (activePanel) {
    case 'move':
      return <MovePanel />
    case 'shader':
      return <EffectsPanel />
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

  return (
    <div className="flex h-full w-full flex-col bg-background">
      <TopToolbar />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-72 shrink-0 flex-col border-r border-border bg-card">
          <div className="flex h-9 shrink-0 items-center border-b border-border px-4">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {PANEL_TITLE[activePanel]}
            </span>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-4">
              <PanelContent />
            </div>
          </ScrollArea>
        </aside>
        <main className="relative min-w-0 flex-1 overflow-hidden bg-black">
          <StageCanvas autoFit />
          <CornerPinOverlay />
        </main>
      </div>
    </div>
  )
}
