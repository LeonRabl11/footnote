import 'server-only';
import {
  streamText,
  stepCountIs,
  convertToModelMessages,
  createUIMessageStreamResponse,
  APICallError,
  type UIMessage,
  type UIMessageChunk,
} from 'ai';
import { google } from '@/lib/embeddings/provider';
import { GENERATION_MODELS } from '@/lib/embeddings/config';
import { createSearchTool } from './search-tool';

// Antwortet exakt mit diesem Satz, wenn die Suchen nichts Passendes liefern.
export const NOT_IN_KNOWLEDGE_BASE = 'Das steht nicht in der Wissensbasis.';

// Sicherheitslimit: max. 4 Schritte (eine typische Frage braucht ~2). Jeder
// Schritt ist eine Modell-Anfrage – klein halten (Free-Tier-Quota).
const MAX_STEPS = 4;

const DEV = process.env.NODE_ENV !== 'production';

// UI-Chunk-Typen, die nur den Stream-Anfang einleiten (noch kein echter Inhalt).
const SETUP_CHUNK_TYPES = new Set(['start', 'start-step']);

// Strenger, agentic Grounding-Prompt. Die "nicht in der Wissensbasis"-Garantie
// kommt aus DIESER Anweisung, nicht aus einem Similarity-Schwellenwert.
const SYSTEM_PROMPT = `Du bist der Wissensassistent "Footnote".
Du hast ein Such-Werkzeug (searchKnowledgeBase). Beantworte Fragen zu den Dokumenten,
indem du damit passende Passagen suchst.

Regeln:
- Antworte AUSSCHLIESSLICH auf Grundlage der gefundenen Passagen. Nutze KEIN externes
  Wissen und rate nicht.
- Nenne die Quelle (Dokumenttitel; falls vorhanden Seite/Zeile).
- Liefern die Suchen nichts Passendes, antworte exakt mit: "${NOT_IN_KNOWLEDGE_BASE}"
- Bei mehrteiligen Fragen pro Teilfrage einmal suchen.
- Antworte in der Sprache der Frage.`;

export type AnswerSource = {
  documentId: string;
  documentTitle: string;
  documentSource: string;
  sourceType: string; // "md" | "txt" | "pdf"
  page: number | null;
  line: number | null;
};

// Optionen, die der Route Handler an toUIMessageStreamResponse übergibt
// (im Wesentlichen messageMetadata) – vom echten streamText-Ergebnis abgeleitet.
type StreamResult = ReturnType<typeof streamText>;
type UIStreamOptions = NonNullable<Parameters<StreamResult['toUIMessageStream']>[0]>;

// Nur beim Quota-Fehler (429 / RESOURCE_EXHAUSTED) wird zurückgefallen.
function isQuotaError(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode === 429) return true;
  const body = typeof error.responseBody === 'string' ? error.responseBody : '';
  return /RESOURCE_EXHAUSTED/i.test(body) || /RESOURCE_EXHAUSTED/i.test(error.message);
}

/**
 * Agentic Antwort mit Modell-Fallback bei erschöpftem Free-Tier-Kontingent.
 *
 * Das AI SDK kennt keinen Modell-Array-Fallback – daher iterieren wir hier
 * selbst über GENERATION_MODELS. Pro Modell: frischer Such-Werkzeug-Lauf +
 * streamText; wir "peeken" den Anfang des UI-Streams, um einen 429 zu erkennen,
 * BEVOR etwas an den Client geht, und wechseln dann zum nächsten Modell.
 *
 * GRENZE (ehrlich): Der Wechsel greift nur, wenn der 429 am Stream-START
 * auftritt (erkennbar vor dem ersten Inhalts-Chunk). Das ist beim Tages-Limit
 * der Normalfall. Käme der 429 erst MITTEN im Stream (nachdem schon Text/Tool-
 * Chunks gesendet wurden), wird NICHT mehr gewechselt – der Fehler erscheint
 * dann regulär im laufenden Stream (Streams sind nicht wiederabspielbar).
 *
 * Rückgabe unverändert: { result, sources }. `sources` ist eine stabile Referenz,
 * in die das Such-Werkzeug des aktiven Modells während des Laufs pusht.
 */
export async function answer(messages: UIMessage[], chatId?: string) {
  // chatId schränkt das Such-Werkzeug auf die Wissensbasis dieses Chats ein.
  // Telemetrie, Modell-Fallback und Quellen-Sammeln bleiben unverändert.
  const { searchKnowledgeBase, sources } = createSearchTool(chatId);
  const modelMessages = await convertToModelMessages(messages);

  async function toUIMessageStreamResponse<_T extends UIMessage = UIMessage>(
    options?: UIStreamOptions,
  ): Promise<Response> {
    for (let i = 0; i < GENERATION_MODELS.length; i++) {
      const modelId = GENERATION_MODELS[i];
      const isLast = i === GENERATION_MODELS.length - 1;
      // Frischer Sammler je Versuch (gleiche Array-Referenz für messageMetadata).
      sources.length = 0;

      if (DEV) console.log(`[model] versuche ${modelId}`);

      let capturedError: unknown;
      const result = streamText({
        model: google(modelId),
        system: SYSTEM_PROMPT,
        messages: modelMessages,
        tools: { searchKnowledgeBase },
        stopWhen: stepCountIs(MAX_STEPS),
        temperature: 0.2,
        // Observability: Trace nach Langfuse (Span-Processor in src/instrumentation.ts).
        // Rein additiv – ändert das Antwort-/Such-Verhalten nicht. Bei Modell-Fallback
        // hängt der aktuelle modelId als Metadata an, damit man im Trace sieht, welches
        // Modell tatsächlich geantwortet hat.
        experimental_telemetry: {
          isEnabled: true,
          functionId: 'footnote-answer',
          metadata: { model: modelId, attempt: i },
        },
        // Keine modell-spezifische Thinking-Option: thinkingLevel gibt es nur bei
        // gemini-3.x, bei 2.5-flash/-lite wirft die API 400. Jedes Modell nutzt
        // seinen Default, damit der Fallback über alle GENERATION_MODELS funktioniert.
        onStepFinish: DEV
          ? ({ toolCalls }) => {
              for (const call of toolCalls) {
                console.log(`[agent] ${call.toolName}(${JSON.stringify(call.input)})`);
              }
            }
          : undefined,
      });

      // onError fängt den Stream-Fehler ab und liefert dem Client einen Text;
      // wir merken uns zusätzlich das Fehlerobjekt zur 429-Erkennung.
      const uiStream = result.toUIMessageStream({
        ...options,
        onError: (error: unknown) => {
          capturedError = error;
          return options?.onError ? options.onError(error) : 'Es ist ein Fehler aufgetreten.';
        },
      } as UIStreamOptions);

      // Anfang abwarten: bis zum ersten echten Inhalts-Chunk oder einem Fehler.
      const reader = uiStream.getReader();
      const buffered: UIMessageChunk[] = [];
      let sawError = false;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffered.push(value);
        if (value.type === 'error') {
          sawError = true;
          break;
        }
        if (!SETUP_CHUNK_TYPES.has(value.type)) break; // erster Inhalt -> Modell lebt
      }

      // Quota-Fehler am Start -> nächstes Modell (außer es war das letzte).
      if (sawError && isQuotaError(capturedError)) {
        await reader.cancel();
        if (!isLast) {
          if (DEV) {
            console.log(
              `[model] Quota erschöpft (429), wechsle zu ${GENERATION_MODELS[i + 1]}`,
            );
          }
          continue;
        }
        // Alle Modelle erschöpft -> klare, vom Client übersetzte Meldung.
        if (DEV) console.log('[model] alle Modelle erschöpft (429)');
        return new Response('quota-exhausted', { status: 503 });
      }

      // Modell lebt (oder Nicht-Quota-Fehler -> regulär an den Client durchreichen):
      // gepufferte Chunks voranstellen, dann den Rest des Streams pumpen.
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          for (const chunk of buffered) controller.enqueue(chunk);
        },
        async pull(controller) {
          const { value, done } = await reader.read();
          if (done) controller.close();
          else controller.enqueue(value);
        },
        cancel(reason) {
          void reader.cancel(reason);
        },
      });

      return createUIMessageStreamResponse({ stream });
    }

    // Unerreichbar (Schleife endet via return), nur zur TS-Vollständigkeit.
    return new Response('quota-exhausted', { status: 503 });
  }

  return { result: { toUIMessageStreamResponse }, sources };
}
