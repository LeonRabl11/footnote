import { z } from 'zod';
import { removeDocumentFromChat } from '@/lib/chat/queries';

export const runtime = 'nodejs';

const Uuid = z.string().uuid();

// DELETE /api/chats/[id]/documents/[documentId] -> Zuordnung entfernen.
// Das Dokument selbst bleibt in der Bibliothek (nur der chat_documents-Eintrag geht weg).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; documentId: string }> },
) {
  const { id, documentId } = await params;
  if (!Uuid.safeParse(id).success || !Uuid.safeParse(documentId).success) {
    return Response.json({ error: 'Ungültige ID.' }, { status: 400 });
  }

  const removed = await removeDocumentFromChat(id, documentId);
  if (!removed) {
    return Response.json({ error: 'Zuordnung nicht gefunden.' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
