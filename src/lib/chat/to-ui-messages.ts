import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';
import type { AnswerSource } from '@/lib/retrieval/answer';

// Persistierte Nachricht (Form aus getChatWithDetails). Reiner Typ – diese Datei
// hat KEIN 'server-only', damit sie auch serverseitig in der RSC-Page genutzt
// werden kann, deren Ergebnis als Props an die Client-Komponente geht.
export type StoredMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources: AnswerSource[] | null;
};

// Wandelt gespeicherte Nachrichten in das UIMessage-Format von useChat. Quellen
// einer Assistenten-Antwort kommen als metadata (gleiche Form wie messageMetadata
// im Stream), sodass die bestehende Quellen-Darstellung 1:1 funktioniert.
export function toUIMessages(rows: StoredMessage[]): FootnoteUIMessage[] {
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: [{ type: 'text', text: row.content }],
    ...(row.role === 'assistant' ? { metadata: { sources: row.sources ?? [] } } : {}),
  }));
}
