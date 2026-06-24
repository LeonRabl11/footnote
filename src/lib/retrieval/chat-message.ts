import type { UIMessage } from 'ai';
import type { AnswerSource } from './answer';

// Metadaten, die der Route Handler an die Assistenten-Nachricht anhängt.
export type ChatMetadata = {
  sources: AnswerSource[];
};

// Gemeinsamer Nachrichtentyp für Server (toUIMessageStreamResponse) und Client
// (useChat). Reiner Typ – kein Laufzeit-Import aus dem server-only-Modul.
export type FootnoteUIMessage = UIMessage<ChatMetadata>;
