import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cosa si sta per eliminare, già pronto per il titolo (es. il nome del progetto). */
  itemName: string;
  /** Riga sotto al titolo: cosa comporta davvero l'eliminazione. */
  description: string;
  onConfirm: () => void;
}

/**
 * Conferma di eliminazione, condivisa da progetti e preset.
 *
 * `AlertDialog` e non `Dialog`: l'eliminazione è irreversibile, e l'alert è quello che intrappola
 * il fuoco e non si chiude cliccando fuori o con Esc per sbaglio.
 *
 * Componente e non due copie perché le due liste si comportano identicamente; se un giorno una
 * delle due dovesse chiedere altro (una spunta "non chiedermelo più", un elenco di dipendenze),
 * conviene separarle di nuovo invece di aggiungere parametri qui.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  itemName,
  description,
  onConfirm,
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Eliminare “{itemName}”?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annulla</AlertDialogCancel>
          {/* variant="destructive" via buttonVariants: AlertDialogAction non inoltra `variant` */}
          <AlertDialogAction className={buttonVariants({ variant: "destructive" })} onClick={onConfirm}>
            Elimina
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
