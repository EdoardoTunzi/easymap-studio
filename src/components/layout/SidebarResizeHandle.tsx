import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'

interface SidebarResizeHandleProps {
  onPointerDown: (event: React.PointerEvent) => void
  className?: string
}

/** Maniglia di trascinamento sul bordo destro della sidebar per ridimensionarla. */
export function SidebarResizeHandle({ onPointerDown, className }: SidebarResizeHandleProps) {
  const { state } = useSidebar()
  // niente da ridimensionare quando è chiusa (offcanvas): la maniglia sparirebbe comunque a w=0
  if (state !== 'expanded') return null

  return (
    <div
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      className={cn(
        'absolute inset-y-0 -right-1 z-30 w-2 cursor-col-resize touch-none select-none',
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-transparent after:transition-colors",
        'hover:after:bg-sidebar-ring active:after:bg-sidebar-ring',
        className,
      )}
    />
  )
}
