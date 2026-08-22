import type { ReactNode } from "react";
import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ControlRowProps {
  label: string;
  /** Valore corrente, allineato a destra sulla stessa riga dell'etichetta. */
  value?: string;
  /** Spiegazione lunga: sta in un tooltip, non stampata sotto il controllo. */
  hint?: ReactNode;
  /** Da che lato esce il tooltip: verso il canvas, mai fuori dallo schermo. */
  hintSide?: "left" | "right";
  /** Comando accessorio a destra (es. un Reset di gruppo). */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Riga di un controllo continuo: etichetta a sinistra, valore corrente sulla stessa riga, comando
 * sotto. Un solo componente per tutte le colonne (§16 Craft della skill apple-design: ciò che si
 * somiglia si comporta uguale — e si scrive una volta sola).
 *
 * L'etichetta usa `.ui-sublabel` (12px, maiuscolo iniziale): il maiuscoletto resta riservato ai
 * titoli di sezione, altrimenti dentro un pannello griderebbero tutti allo stesso volume (§15).
 * Il valore usa `.ui-value` — cifre tabellari, così non balla mentre si trascina lo slider.
 */
export function ControlRow({ label, value, hint, hintSide = "right", action, className, children }: ControlRowProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="ui-sublabel flex items-center gap-1.5 text-muted-foreground">
          {/* i nomi degli uniform arrivano dallo shader tutti minuscoli: la maiuscola iniziale li
              allinea alle etichette scritte a mano senza dover riscrivere ogni shader */}
          <span className="inline-block first-letter:uppercase">{label}</span>
          {/* §16 (Simplicity): il percorso comune resta visibile, il contesto sta un livello più in
              là. Le note stampate sotto ogni slider occupavano più spazio dei controlli stessi.
              Il trigger è un button, così la spiegazione si raggiunge anche da tastiera. */}
          {hint && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Cos'è "${label}"`}
                  className="inline-flex cursor-help items-center text-muted-foreground/40 transition-colors duration-[--dur-fast] hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
                >
                  <HelpCircle className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={hintSide} className="max-w-64 leading-relaxed">
                {hint}
              </TooltipContent>
            </Tooltip>
          )}
        </span>
        {value !== undefined && !action && <span className="ui-value shrink-0 text-foreground/80">{value}</span>}
        {action && (
          <span className="flex shrink-0 items-center gap-2">
            {value !== undefined && <span className="ui-value text-foreground/80">{value}</span>}
            {action}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
