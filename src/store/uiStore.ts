import { create } from 'zustand'

/** Sezioni selezionabili dalla top toolbar; determinano il contenuto del pannello sinistro. */
export type Panel = 'move' | 'shader' | 'palette' | 'assets' | 'output'

interface UiState {
  activePanel: Panel
  setActivePanel: (panel: Panel) => void
}

export const useUiStore = create<UiState>((set) => ({
  activePanel: 'shader',
  setActivePanel: (activePanel) => set({ activePanel }),
}))
