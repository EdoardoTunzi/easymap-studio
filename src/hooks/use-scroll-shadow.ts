import { useEffect, useRef, useState } from "react";

/**
 * Dice se il contenuto di una ScrollArea è già stato scorso, per accendere la sfumatura sul bordo
 * alto (§12 della skill apple-design: dove la chrome copre il contenuto si sfuma, invece di
 * piantarci sopra una riga fissa da 1px — e solo quando c'è davvero qualcosa di nascosto).
 *
 * Il ref va sul contenitore della ScrollArea: il viewport scrollabile è un figlio di Radix.
 */
export function useScrollShadow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const viewport = ref.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;
    const onScroll = () => setScrolled(viewport.scrollTop > 2);
    onScroll();
    viewport.addEventListener("scroll", onScroll, { passive: true });
    return () => viewport.removeEventListener("scroll", onScroll);
  }, []);

  return { ref, scrolled };
}
