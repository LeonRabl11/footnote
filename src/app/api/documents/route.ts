import { listDocuments } from '@/lib/chat/queries';

export const runtime = 'nodejs';

// GET /api/documents -> alle Bibliotheks-Dokumente (id, title, sourceType, createdAt).
// Global, chat-unabhängig – Quelle für die spätere "Dokument zu Chat hinzufügen"-UI.
export async function GET() {
  const documents = await listDocuments();
  return Response.json(documents);
}
