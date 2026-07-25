import { create } from 'zustand'

/**
 * Modalità "Live": quando attiva, la finestra Output NON si aggiorna ad ogni modifica del
 * Control (aggiunte layer, spostamenti, slider...). Le modifiche passano all'Output solo su
 * comando esplicito ("Esegui in output"). Il preview dell'editor mostra sempre lo stato live.
 */
interface OutputState {
  /** Se true, l'Output è "congelato" all'ultimo stato inviato. */
  live: boolean
  /** Incrementato per forzare un invio dello stato corrente all'Output. */
  pushId: number
  /** In Live: ci sono modifiche non ancora inviate all'Output. */
  dirty: boolean
  setLive: (live: boolean) => void
  pushToOutput: () => void
  markDirty: () => void
  clearDirty: () => void
}

export const useOutputStore = create<OutputState>((set) => ({
  live: false,
  pushId: 0,
  dirty: false,
  setLive: (live) => set({ live }),
  pushToOutput: () => set((s) => ({ pushId: s.pushId + 1 })),
  markDirty: () => set((s) => (s.dirty ? s : { dirty: true })),
  clearDirty: () => set((s) => (s.dirty ? { dirty: false } : s)),
}))
