import { answer } from '@/lib/retrieval/answer';
import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Chat-Endpunkt für useChat. Jede Frage wird einzeln behandelt – kein
// Gesprächsverlauf ins Retrieval (für das MVP korrekt).
export async function POST(request: Request) {
  const { messages }: { messages: FootnoteUIMessage[] } = await request.json();

  // Letzte User-Nachricht als Frage; Text aus ihren text-Parts zusammensetzen.
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const query = (lastUser?.parts ?? [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join(' ')
    .trim();

  if (!query) {
    return new Response('Keine Frage gefunden.', { status: 400 });
  }

  // Bestehende answer()-Funktion wiederverwenden – NICHT neu bauen.
  const { result, sources } = await answer(query);

  // Stream zurückgeben und die (deduplizierten) Quellen als messageMetadata
  // beim Abschluss an die Assistenten-Nachricht hängen.
  return result.toUIMessageStreamResponse<FootnoteUIMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { sources };
      }
    },
  });
}
