import { z } from 'zod';
import { deleteDocument } from '@/lib/chat/queries';

export const runtime = 'nodejs';

const Uuid = z.string().uuid();

// DELETE /api/documents/[id] -> Dokument ENDGÜLTIG aus der Bibliothek löschen.
// Entfernt das Dokument samt seiner chunks UND aller chat_documents-Zuordnungen
// (überall, nicht nur im aktuellen Chat) – via ON DELETE CASCADE (siehe schema.ts).
// Klar abgegrenzt von DELETE /api/chats/[id]/documents/[documentId], das nur die
// Zuordnung zu EINEM Chat entfernt und das Dokument selbst bestehen lässt.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) {
    return Response.json({ error: 'Ungültige Dokument-ID.' }, { status: 400 });
  }

  const deleted = await deleteDocument(id);
  if (!deleted) {
    return Response.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
