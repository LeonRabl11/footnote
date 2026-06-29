// Leichtgewichtiges Signal, damit entkoppelte Client-Komponenten (Sidebar vs.
// Arbeitsbereich) ihre Chat-Liste neu laden, ohne globalen State/Store. Wird
// ausgelöst bei: neuer Chat, erste Nachricht (Titel ändert sich).
export const CHATS_CHANGED_EVENT = 'footnote:chats-changed';

export function emitChatsChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
  }
}
