import { MonitorPlay } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function OutputLauncher() {
  const openOutput = () => {
    window.open(
      '/output',
      'easyvj-output',
      'width=1280,height=720,menubar=no,toolbar=no,location=no',
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Finestra di proiezione
      </span>
      <Button onClick={openOutput} className="w-full gap-2">
        <MonitorPlay className="size-4" />
        Apri finestra Output
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Apre una finestra pulita e a schermo intero da trascinare sul proiettore. Resta sincronizzata
        in tempo reale con questo pannello di controllo.
      </p>
    </div>
  )
}
