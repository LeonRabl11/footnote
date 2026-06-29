import { z } from 'zod';
import { createChat, listChats } from '@/lib/chat/queries';

export const runtime = 'nodejs';

const CreateSchema = z.object({
  // Titel optional – fehlt er, vergibt die DB den Default "Neuer Chat".
  title: z.string().trim().min(1).max(200).optional(),
});

// POST /api/chats -> neuen Chat anlegen, gibt { id } zurück.
export async function POST(request: Request) {
  // Leerer Body ist erlaubt (Titel optional).
  const raw = await request.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return Response.json({ error: 'Ungültiger Titel.' }, { status: 400 });
  }

  const chat = await createChat(parsed.data.title);
  return Response.json({ id: chat.id }, { status: 201 });
}

// GET /api/chats -> Liste aller Chats (id, title, updatedAt), neueste zuerst.
export async function GET() {
  const chats = await listChats();
  return Response.json(chats);
}
