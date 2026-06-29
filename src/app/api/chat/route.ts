import { after } from 'next/server';
import { z } from 'zod';
import { answer } from '@/lib/retrieval/answer';
import { saveUserMessage, saveAssistantMessage } from '@/lib/chat/queries';
import { langfuseSpanProcessor } from '@/instrumentation';
import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel: Default-Funktionslaufzeit ist kurz. Die agentic Antwort macht mehrere
// Modell-Aufrufe (Suche + Generierung, ggf. Modell-Fallback) und kann länger
// dauern. 60 s liegt sicher im Hobby-Limit; höhere Werte bräuchten Fluid compute
// (Dashboard-Einstellung, kein Code).
export const maxDuration = 60;

// Body-Validierung: chatId ist jetzt PFLICHT (jede Anfrage gehört zu einem Chat).
const BodySchema = z.object({
  chatId: z.string().uuid(),
  messages: z.array(z.any()).min(1),
});

// Text einer UI-Message aus ihren text-Parts zusammensetzen (Tool-/sonstige
// Parts ignorieren).
function textFromParts(parts: FootnoteUIMessage['parts']): string {
  // flatMap mit Inline-Guard, damit TypeScript den text-Part korrekt verengt.
  return parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join('');
}

// Chat-Endpunkt für useChat. Agentic: das Modell entscheidet selbst, ob/wie oft
// es die (jetzt pro Chat gescopte) Wissensbasis durchsucht (Tool-Calling in answer()).
export async function POST(request: Request) {
  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return new Response('Ungültiger Request (chatId und messages erforderlich).', {
      status: 400,
    });
  }
  const { chatId } = parsed.data;
  const messages = parsed.data.messages as FootnoteUIMessage[];

  // Letzte User-Nachricht persistieren (best effort – ein DB-Fehler darf den
  // Antwort-Stream nicht verhindern).
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const userText = lastUser ? textFromParts(lastUser.parts) : '';
  if (userText) {
    try {
      await saveUserMessage(chatId, userText);
    } catch (error) {
      console.error('[chat] Speichern der User-Nachricht fehlgeschlagen:', error);
    }
  }

  // Bestehende answer()-Funktion wiederverwenden – NICHT neu bauen. `chatId`
  // schränkt das Such-Werkzeug auf die Wissensbasis dieses Chats ein.
  // `sources` wird während des Laufs vom Such-Werkzeug befüllt.
  const { result, sources } = await answer(messages, chatId);

  // Serverless (Vercel): nach dem Senden der Antwort die Langfuse-Spans flushen,
  // damit auf kurzlebigen Functions keine Traces verloren gehen. `after()` läuft
  // nach Abschluss der Response. Optional verkettet: vor register() (oder ohne
  // Langfuse-Keys) ist der Processor undefined – dann passiert nichts.
  after(async () => {
    await langfuseSpanProcessor?.forceFlush();
  });

  // Stream zurückgeben und die (deduplizierten) gesammelten Quellen als
  // messageMetadata beim Abschluss an die Assistenten-Nachricht hängen.
  // onFinish persistiert die fertige Assistenten-Antwort (Text + Quellen) und
  // aktualisiert chats.updatedAt. Greift NUR beim erfolgreichen Abschluss; bei
  // Abbruch/Quota-Wechsel (anderer Stream) fällt es korrekt weg.
  return result.toUIMessageStreamResponse<FootnoteUIMessage>({
    messageMetadata: ({ part }) => {
      if (part.type === 'finish') {
        return { sources };
      }
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted) return;
      const text = textFromParts(responseMessage.parts);
      if (!text) return;
      try {
        await saveAssistantMessage(chatId, text, sources);
      } catch (error) {
        console.error('[chat] Speichern der Assistenten-Nachricht fehlgeschlagen:', error);
      }
    },
  });
}
