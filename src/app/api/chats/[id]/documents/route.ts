import { z } from 'zod';
import { addDocumentToChat, documentExists } from '@/lib/chat/queries';

export const runtime = 'nodejs';

const Uuid = z.string().uuid();
const BodySchema = z.object({ documentId: z.string().uuid() });

// POST /api/chats/[id]/documents (body: { documentId }) -> bestehendes Dokument
// dem Chat zuordnen. Dedup über den PK (chatId, documentId): erneutes Zuordnen
// ist ein No-op (idempotent).
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!Uuid.safeParse(id).success) {
    return Response.json({ error: 'Ungültige Chat-ID.' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'documentId (uuid) erforderlich.' }, { status: 400 });
  }
  const { documentId } = parsed.data;

  // Sauberer 404 statt FK-Fehler, wenn das Dokument nicht (mehr) existiert.
  if (!(await documentExists(documentId))) {
    return Response.json({ error: 'Dokument nicht gefunden.' }, { status: 404 });
  }

  // chatId-Existenz wird vom FK abgesichert; ein unbekannter Chat -> FK-Fehler (500).
  await addDocumentToChat(id, documentId);
  return new Response(null, { status: 204 });
}
