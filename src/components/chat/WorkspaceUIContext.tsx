'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// Reiner UI-Zustand für die Responsivität (keine Daten/Logik): WELCHES Overlay
// gerade offen ist. Es darf immer nur EINES offen sein -> ein einziger Wert
// koppelt die Chat-Listen-Schublade (links) und das Kontext-Panel (rechts),
// die in verschiedenen Teilbäumen liegen (Layout vs. Seite).
type Overlay = 'none' | 'sidebar' | 'panel';

type WorkspaceUI = {
  overlay: Overlay;
  toggleSidebar: () => void;
  togglePanel: () => void;
  closeOverlay: () => void;
};

const WorkspaceUIContext = createContext<WorkspaceUI | null>(null);

export function WorkspaceUIProvider({ children }: { children: ReactNode }) {
  const [overlay, setOverlay] = useState<Overlay>('none');

  const toggleSidebar = useCallback(
    () => setOverlay((o) => (o === 'sidebar' ? 'none' : 'sidebar')),
    [],
  );
  const togglePanel = useCallback(
    () => setOverlay((o) => (o === 'panel' ? 'none' : 'panel')),
    [],
  );
  const closeOverlay = useCallback(() => setOverlay('none'), []);

  // Auf Desktop (>= 1024px) liegen beide Bereiche fest im Layout -> kein Overlay.
  // Beim Vergrößern das ggf. offene Overlay zurücksetzen, damit kein verwaister
  // abgedunkelter Hintergrund stehen bleibt.
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const sync = () => {
      if (desktop.matches) setOverlay('none');
    };
    sync();
    desktop.addEventListener('change', sync);
    return () => desktop.removeEventListener('change', sync);
  }, []);

  // Escape schließt das offene Overlay (Tastatur-Komfort).
  useEffect(() => {
    if (overlay === 'none') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOverlay('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay]);

  const value = useMemo<WorkspaceUI>(
    () => ({ overlay, toggleSidebar, togglePanel, closeOverlay }),
    [overlay, toggleSidebar, togglePanel, closeOverlay],
  );

  return (
    <WorkspaceUIContext.Provider value={value}>
      {children}
    </WorkspaceUIContext.Provider>
  );
}

export function useWorkspaceUI(): WorkspaceUI {
  const ctx = useContext(WorkspaceUIContext);
  if (!ctx) {
    throw new Error('useWorkspaceUI must be used within a WorkspaceUIProvider');
  }
  return ctx;
}
