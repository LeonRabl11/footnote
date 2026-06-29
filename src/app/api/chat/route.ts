import { after } from 'next/server';
import { answer } from '@/lib/retrieval/answer';
import { langfuseSpanProcessor } from '@/instrumentation';
import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Chat-Endpunkt für useChat. Agentic: das Modell entscheidet selbst, ob/wie oft
// es die Wissensbasis durchsucht (Tool-Calling in answer()).
export async function POST(request: Request) {
  const { messages }: { messages: FootnoteUIMessage[] } = await request.json();

  if (messages.length === 0) {
    return new Response('Keine Nachrichten.', { status: 400 });
  }

  // Bestehende answer()-Funktion wiederverwenden – NICHT neu bauen.
  // `sources` wird während des Laufs vom Such-Werkzeug befüllt.
  const { result, sources } = await answer(messages);

  // Serverless (Vercel): nach dem Senden der Antwort die Langfuse-Spans flushen,
  // damit auf kurzlebigen Functions keine Traces verloren gehen. `after()` läuft
  // nach Abschluss der Response. Optional verkettet: vor register() (oder ohne
  // Langfuse-Keys) ist der Processor undefined – dann passiert nichts.
  after(async () => {
    await langfuseSpanProcessor?.forceFlush();
  });

  // Stream zurückgeben und die (deduplizierten) gesammelten Quellen als
  // messageMetadata beim Abschluss an die Assistenten-Nachricht hängen.
  return result.toUIMessageStreamResponse<FootnoteUIMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { sources };
      }
    },
  });
}
