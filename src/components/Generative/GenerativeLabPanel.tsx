import { useCallback, useEffect, useState } from 'react'
import { Dices, Save, Plus, Layers, X, FilePlus2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useUiStore } from '@/store/uiStore'
import { useGenerativeStore } from '@/store/generativeStore'
import { useLayersStore } from '@/store/layersStore'
import {
  deleteGenerativeVisual,
  listGenerativeVisuals,
  saveGenerativeVisual,
  type GenerativeVisual,
} from '@/lib/persistence'
import { publishGenerativeShader } from '@/lib/sync'
import { GenerativePreview } from './GenerativePreview'
import { ModuleStackEditor } from './ModuleStackEditor'
import { CodeEditorTab } from './CodeEditorTab'
import { GenerativeLibrary } from './GenerativeLibrary'
import { useLiveApply, applyDraftToActiveLayer, setSavedVisualNames } from './useLiveApply'

export function GenerativeLabPanel() {
  const toggleGenerativeLab = useUiStore((s) => s.toggleGenerativeLab)
  const name = useGenerativeStore((s) => s.name)
  const shader = useGenerativeStore((s) => s.shader)
  const liveApply = useGenerativeStore((s) => s.liveApply)
  const setName = useGenerativeStore((s) => s.setName)
  const setLiveApply = useGenerativeStore((s) => s.setLiveApply)
  const randomize = useGenerativeStore((s) => s.randomize)
  const reset = useGenerativeStore((s) => s.reset)

  const addLayer = useLayersStore((s) => s.addLayer)

  const [visuals, setVisuals] = useState<GenerativeVisual[]>([])
  const [savedFlash, setSavedFlash] = useState(false)

  useLiveApply()

  const refresh = useCallback(async () => {
    const list = await listGenerativeVisuals()
    setVisuals(list)
    // tiene aggiornata la lista dei nomi "veri" usata dalla pulizia degli shader temporanei
    setSavedVisualNames(list.map((v) => v.name))
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Salva il draft corrente e ne restituisce il nome definitivo (può essere deduplicato). */
  const persistDraft = useCallback(async (): Promise<string | null> => {
    const { editingId, name: draftName, mode, stack, source, shader: parsed } =
      useGenerativeStore.getState()
    if (!parsed) return null
    const saved = await saveGenerativeVisual({ id: editingId, name: draftName, mode, stack, source })
    // markSaved prima del refresh: così il draft ricorda di essere già su disco e il prossimo
    // salvataggio aggiorna il record invece di crearne una copia
    useGenerativeStore.getState().markSaved(saved.id, saved.name)
    publishGenerativeShader(saved.source)
    await refresh()
    return saved.name
  }, [refresh])

  const handleSave = async () => {
    const savedName = await persistDraft()
    if (!savedName) return
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 1500)
  }

  const handleCreateLayer = async () => {
    const shaderName = await persistDraft()
    // layer puramente generativo: nessun media, l'effetto riempie l'intero quad
    if (shaderName) addLayer({ name: shaderName, shaderName })
  }

  const handleApplyToActive = async () => {
    const shaderName = await persistDraft()
    const parsed = useGenerativeStore.getState().shader
    if (!shaderName || !parsed) return
    // stessa strada del live: azzera i params che il layer aveva memorizzato per questo nome,
    // altrimenti maschererebbero i nuovi valori e l'effetto sembrerebbe non aggiornarsi
    applyDraftToActiveLayer(parsed, useGenerativeStore.getState().source)
  }

  const handleDuplicate = async (visual: GenerativeVisual) => {
    const saved = await saveGenerativeVisual({
      id: null,
      name: `${visual.name} copy`,
      mode: visual.mode,
      stack: visual.stack,
      source: visual.source,
    })
    publishGenerativeShader(saved.source)
    await refresh()
  }

  const handleDelete = async (visual: GenerativeVisual) => {
    await deleteGenerativeVisual(visual.id)
    if (useGenerativeStore.getState().editingId === visual.id) reset()
    await refresh()
  }

  const handleLoad = (visual: GenerativeVisual) => {
    useGenerativeStore.getState().loadVisual(visual)
  }

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-3">
        <span className="truncate text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/70">
          Generative Lab
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground"
          onClick={toggleGenerativeLab}
          aria-label="Chiudi Generative Lab"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* [&>div>div]:block! — il Viewport di Radix avvolge il contenuto in un div `display:table;
          min-width:100%`, che non si restringe sotto la larghezza naturale del contenuto: a
          pannello stretto il lato destro finiva tagliato fuori invece di adattarsi. */}
      <ScrollArea className="min-h-0 w-full flex-1 [&>div>div]:block!">
        <div className="flex w-full min-w-0 flex-col gap-4 p-3">
          <GenerativePreview />

          <div className="flex items-center gap-1.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome del visual"
              className="h-8 min-w-0 flex-1 text-sm"
            />
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              onClick={reset}
              title="Nuovo visual"
              aria-label="Nuovo visual"
            >
              <FilePlus2 className="size-4" />
            </Button>
          </div>

          {/* Live: le modifiche finiscono sul layer attivo mentre le fai. Spegnendolo si torna
              al flusso manuale col pulsante "Al layer attivo". */}
          <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card/40 px-2.5 py-2">
            <div className="flex min-w-0 flex-col">
              <Label htmlFor="generative-live" className="text-xs font-medium">
                Applica in tempo reale
              </Label>
              <span className="truncate text-[11px] text-muted-foreground">
                {liveApply ? 'Il layer attivo segue le modifiche' : 'Modifiche solo in anteprima'}
              </span>
            </div>
            <Switch id="generative-live" checked={liveApply} onCheckedChange={setLiveApply} />
          </div>

          {/* min-w-0 + truncate su ogni voce: a pannello stretto le etichette si accorciano
              invece di far debordare la griglia */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="secondary"
              size="sm"
              className="min-w-0 gap-1.5 px-2"
              onClick={randomize}
            >
              <Dices className="size-3.5 shrink-0" />
              <span className="truncate">Genera variante</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-w-0 gap-1.5 px-2"
              onClick={handleSave}
              disabled={!shader}
            >
              {savedFlash ? (
                <Check className="size-3.5 shrink-0 text-emerald-400" />
              ) : (
                <Save className="size-3.5 shrink-0" />
              )}
              <span className="truncate">{savedFlash ? 'Salvato' : 'Salva'}</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              className="min-w-0 gap-1.5 px-2"
              onClick={handleCreateLayer}
              disabled={!shader}
            >
              <Plus className="size-3.5 shrink-0" />
              <span className="truncate">Nuovo layer</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-0 gap-1.5 px-2"
              onClick={handleApplyToActive}
              disabled={!shader || liveApply}
              title={
                liveApply
                  ? 'Non serve: le modifiche vanno già sul layer attivo in tempo reale'
                  : 'Applica come effetto del layer attivo (mantiene il suo asset e mapping)'
              }
            >
              <Layers className="size-3.5 shrink-0" />
              <span className="truncate">Al layer attivo</span>
            </Button>
          </div>

          <Separator />

          <Tabs defaultValue="modules">
            <TabsList className="w-full">
              <TabsTrigger value="modules">Moduli</TabsTrigger>
              <TabsTrigger value="code">Codice</TabsTrigger>
            </TabsList>
            <TabsContent value="modules" className="pt-2">
              <ModuleStackEditor />
            </TabsContent>
            <TabsContent value="code" className="pt-2">
              <CodeEditorTab />
            </TabsContent>
          </Tabs>

          <Separator />

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              I miei visual
            </span>
            <GenerativeLibrary
              visuals={visuals}
              onLoad={handleLoad}
              onDuplicate={handleDuplicate}
              onDelete={handleDelete}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
