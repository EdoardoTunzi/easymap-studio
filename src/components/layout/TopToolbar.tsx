import { Move, Sparkles, Palette, Images, MonitorPlay, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useUiStore, type Panel } from '@/store/uiStore'
import { cn } from '@/lib/utils'

const NAV: { id: Panel; label: string; icon: typeof Move }[] = [
  { id: 'move', label: 'Move', icon: Move },
  { id: 'shader', label: 'Shader', icon: Sparkles },
  { id: 'palette', label: 'Palette', icon: Palette },
  { id: 'assets', label: 'Assets', icon: Images },
  { id: 'output', label: 'Output', icon: MonitorPlay },
]

export function TopToolbar() {
  const activePanel = useUiStore((s) => s.activePanel)
  const setActivePanel = useUiStore((s) => s.setActivePanel)

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-card px-3">
      <div className="flex items-center gap-1">
        <SidebarTrigger />
        <Separator orientation="vertical" className="mx-1 h-5" />
      </div>

      <nav className="flex items-center gap-1">
        {NAV.map(({ id, label, icon: Icon }) => (
          <Button
            key={id}
            variant={activePanel === id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setActivePanel(id)}
            className={cn(
              'gap-1.5 text-xs uppercase tracking-wide',
              activePanel === id ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Button>
        ))}
      </nav>

      <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Impostazioni">
        <Settings className="size-4" />
      </Button>
    </header>
  )
}
