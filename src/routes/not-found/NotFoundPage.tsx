import { Link } from "react-router-dom";

/** Pagina 404: qualunque URL fuori da /control e /output finisce qui. */
export function NotFoundPage() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-3 bg-background text-center text-foreground">
      <p className="text-sm font-medium tracking-wide text-muted-foreground">404</p>
      <p className="text-lg font-semibold">Pagina non trovata</p>
      <Link to="/control" className="text-sm text-primary underline underline-offset-4 hover:no-underline">
        Torna all'app
      </Link>
    </div>
  );
}
