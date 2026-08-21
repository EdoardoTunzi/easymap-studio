import { useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore, type LayerSection } from "@/store/uiStore";

interface CollapsibleSectionProps {
  section: LayerSection;
  title: string;
  /** Indicatore a destra del titolo (es. numero di maschere): leggibile anche a sezione chiusa. */
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Blocco richiudibile (colonna destra o sinistra); lo stato di apertura è ricordato tra le sessioni.
 *
 * L'apertura è animata con `grid-template-rows: 0fr → 1fr`: il contenuto entra ed esce lungo lo
 * stesso percorso (§7 della skill apple-design), invece di comparire di scatto. `overflow: hidden`
 * serve solo mentre la transizione è in corso — a riposo torna `visible`, altrimenti taglierebbe
 * popover e menu ancorati ai controlli interni.
 */
export function CollapsibleSection({ section, title, badge, children }: CollapsibleSectionProps) {
  const open = useUiStore((s) => s.sectionsOpen[section]);
  const toggleSection = useUiStore((s) => s.toggleSection);
  const [animating, setAnimating] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  return (
    <div className="border-b border-sidebar-border/60 last:border-b-0">
      <button
        type="button"
        onClick={() => {
          setAnimating(true);
          toggleSection(section);
        }}
        aria-expanded={open}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left",
          "transition-colors duration-[--dur-press] ease-[--ease-out]",
          "hover:bg-sidebar-accent/40 active:bg-sidebar-accent/60",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sidebar-ring",
        )}
      >
        <ChevronRight
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground",
            "transition-transform duration-[--dur-base] ease-[--ease-fluid]",
            open && "rotate-90",
          )}
        />
        <span className={cn("ui-eyebrow flex-1", open ? "text-sidebar-foreground/90" : "text-muted-foreground")}>
          {title}
        </span>
        {badge}
      </button>

      <div
        ref={gridRef}
        // il wrapper in griglia è ciò che si anima; il figlio misura la propria altezza naturale
        className={cn(
          "grid transition-[grid-template-rows] duration-[--dur-base] ease-[--ease-fluid]",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          (animating || !open) && "overflow-hidden",
        )}
        onTransitionEnd={(e) => {
          if (e.target === gridRef.current && e.propertyName === "grid-template-rows") setAnimating(false);
        }}
      >
        <div
          className={cn(
            "min-h-0",
            // la dissolvenza è più corta dell'altezza: il testo sparisce prima di schiacciarsi
            "transition-opacity duration-[--dur-fast] ease-[--ease-out]",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="px-4 pt-0.5 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
