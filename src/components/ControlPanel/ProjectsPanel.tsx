import { useCallback, useEffect, useState } from 'react'
import { Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  saveProject,
  loadProject,
  deleteProject,
  listProjects,
  type StoredProject,
} from '@/lib/persistence'

type ProjectListItem = Omit<StoredProject, 'layers'>

export function ProjectsPanel() {
  const [projects, setProjects] = useState<ProjectListItem[]>([])
  const [name, setName] = useState('')

  const refresh = useCallback(async () => {
    setProjects(await listProjects())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await saveProject(trimmed)
    setName('')
    refresh()
  }

  const handleDelete = async (id: string) => {
    await deleteProject(id)
    refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Progetti
      </span>
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
          }}
          placeholder="Nome progetto…"
        />
        <Button size="icon" variant="secondary" onClick={handleSave} disabled={!name.trim()} aria-label="Salva progetto">
          <Save className="size-4" />
        </Button>
      </div>
      {projects.length > 0 && (
        <ul className="flex flex-col gap-1">
          {projects.map((p) => (
            <li key={p.id} className="flex items-center gap-1">
              <Button
                variant="ghost"
                onClick={() => loadProject(p.id)}
                className="h-8 flex-1 justify-start truncate px-2 text-sm font-normal"
                title={new Date(p.updatedAt).toLocaleString()}
              >
                {p.name}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDelete(p.id)}
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Elimina ${p.name}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
