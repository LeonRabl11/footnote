import { z } from 'zod';
import { getChatWithDetails, deleteChat } from '@/lib/chat/queries';

export const runtime = 'nodejs';

const Uuid = z.string().uuid();

// GET /api/chats/[id] -> ein Chat mit seinen Dokumenten UND seinen Nachrichten.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) {
    return Response.json({ error: 'Ungültige Chat-ID.' }, { status: 400 });
  }

  const chat = await getChatWithDetails(id);
  if (!chat) {
    return Response.json({ error: 'Chat nicht gefunden.' }, { status: 404 });
  }
  return Response.json(chat);
}

// DELETE /api/chats/[id] -> Chat samt Verknüpfungen/Nachrichten löschen
// (chat_documents und messages hängen per ON DELETE CASCADE).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) {
    return Response.json({ error: 'Ungültige Chat-ID.' }, { status: 400 });
  }

  const deleted = await deleteChat(id);
  if (!deleted) {
    return Response.json({ error: 'Chat nicht gefunden.' }, { status: 404 });
  }
  return new Response(null, { status: 204 });
}
