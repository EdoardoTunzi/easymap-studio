import { create } from 'zustand'

/** Sezioni selezionabili dalla top toolbar; determinano il contenuto del pannello sinistro. */
export type Panel = 'layers' | 'move' | 'shader' | 'palette' | 'assets' | 'output'

interface UiState {
  activePanel: Panel
  setActivePanel: (panel: Panel) => void
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'layers',
  setActivePanel: (activePanel) => set({ activePanel }),
}))
