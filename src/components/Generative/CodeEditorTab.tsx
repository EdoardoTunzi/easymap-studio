import CodeMirror, { EditorView } from '@uiw/react-codemirror'
import { cpp } from '@codemirror/lang-cpp'
import { Button } from '@/components/ui/button'
import { useGenerativeStore } from '@/store/generativeStore'

// lineWrapping: in un pannello stretto le righe lunghe altrimenti allargherebbero il contenuto
const EXTENSIONS = [cpp(), EditorView.lineWrapping]

export function CodeEditorTab() {
  const source = useGenerativeStore((s) => s.source)
  const shader = useGenerativeStore((s) => s.shader)
  const mode = useGenerativeStore((s) => s.mode)
  const setSource = useGenerativeStore((s) => s.setSource)
  const recomposeFromModules = useGenerativeStore((s) => s.recomposeFromModules)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">
          {mode === 'code' ? 'Codice modificato a mano' : 'Generato dai moduli'}
        </span>
        {mode === 'code' && (
          <Button variant="ghost" size="sm" className="h-6 text-[11px]" onClick={recomposeFromModules}>
            Ricomponi dai moduli
          </Button>
        )}
      </div>

      <div className="min-w-0 overflow-hidden rounded-md border border-border">
        <CodeMirror
          value={source}
          height="420px"
          width="100%"
          theme="dark"
          extensions={EXTENSIONS}
          onChange={setSource}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
        />
      </div>

      {!shader && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-2 text-[11px] leading-snug text-destructive-foreground">
          La sorgente non definisce <code>processColor</code>: l'anteprima resta ferma finché il
          codice non è valido.
        </p>
      )}

      <p className="text-[11px] leading-snug text-muted-foreground">
        Entry point:{' '}
        <code className="text-foreground">
          vec4 processColor(sampler2D tex, vec2 uv, float time, vec2 resolution)
        </code>
        . Gli uniform float con commento <code className="text-foreground">@min @max @default</code>{' '}
        diventano slider automatici nel pannello Shader.
      </p>
    </div>
  )
}
