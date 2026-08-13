import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUiStore, type LayerSection } from '@/store/uiStore'

interface CollapsibleSectionProps {
  section: LayerSection
  title: string
  /** Indicatore a destra del titolo (es. numero di maschere): leggibile anche a sezione chiusa. */
  badge?: ReactNode
  children: ReactNode
}

/** Blocco richiudibile della colonna destra; lo stato di apertura è ricordato tra le sessioni. */
export function CollapsibleSection({ section, title, badge, children }: CollapsibleSectionProps) {
  const open = useUiStore((s) => s.sectionsOpen[section])
  const toggleSection = useUiStore((s) => s.toggleSection)

  return (
    <div className="border-b border-sidebar-border last:border-b-0">
      <button
        type="button"
        onClick={() => toggleSection(section)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left transition-colors hover:bg-accent/30"
      >
        <ChevronRight
          className={cn(
            'size-3.5 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-90',
          )}
        />
        <span className="flex-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {badge}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  )
}
