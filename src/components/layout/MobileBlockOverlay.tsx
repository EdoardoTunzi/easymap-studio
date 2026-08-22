import { MonitorSmartphone } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Blocco a schermo intero sotto i 768px (stessa soglia di `useIsMobile`, il breakpoint `md` di
 * Tailwind): corner-pin, sidebar ridimensionabili e canvas WebGL non hanno senso su un telefono,
 * quindi si copre l'app con un messaggio invece di lasciar provare un layout che non funzionerebbe.
 * Un tablet in orizzontale (1024px+) resta sopra soglia e non lo vede mai — di proposito non lo
 * si dice nel testo, altrimenti si invita a provare comunque da telefono ruotandolo.
 *
 * Montato una sola volta in App.tsx, fuori dalle route: copre sia /control che /output.
 */
export function MobileBlockOverlay() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-100 flex items-center justify-center bg-background p-6 duration-300">
      <div className="flex max-w-xs flex-col items-center gap-3 text-center">
        <MonitorSmartphone className="size-8 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">Serve uno schermo più grande</p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          EasyMap Studio è pensato per il posizionamento preciso delle proiezioni: apri questa pagina da un computer per continuare.
        </p>
      </div>
    </div>
  );
}
