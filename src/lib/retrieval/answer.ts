import 'server-only';
import { streamText, stepCountIs, convertToModelMessages, type UIMessage } from 'ai';
import { google } from '@/lib/embeddings/provider';
import { GENERATION_MODEL } from '@/lib/embeddings/config';
import { createSearchTool } from './search-tool';

// Antwortet exakt mit diesem Satz, wenn die Suchen nichts Passendes liefern.
export const NOT_IN_KNOWLEDGE_BASE = 'Das steht nicht in der Wissensbasis.';

// Sicherheitslimit: max. 4 Schritte (eine typische Frage braucht ~2). Jeder
// Schritt ist eine Modell-Anfrage – klein halten (Free-Tier-Quota).
const MAX_STEPS = 4;

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

/**
 * Agentic Antwort: das Modell entscheidet selbst, ob/wie oft es die Wissensbasis
 * durchsucht (Tool-Calling), bis zu MAX_STEPS. Gibt den Stream zurück sowie den
 * anfrage-lokalen Quellen-Sammler, der während des Laufs befüllt wird und beim
 * finish-Part als messageMetadata angehängt wird (Format unverändert).
 */
export async function answer(messages: UIMessage[]) {
  const { searchKnowledgeBase, sources } = createSearchTool();
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: google(GENERATION_MODEL),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
    tools: { searchKnowledgeBase },
    stopWhen: stepCountIs(MAX_STEPS),
    temperature: 0.2,
    providerOptions: {
      // gemini-3.x "denkt" vor der Antwort; niedriges Level => streamt früher los.
      google: { thinkingConfig: { thinkingLevel: 'low' } },
    },
    onStepFinish:
      process.env.NODE_ENV !== 'production'
        ? ({ toolCalls }) => {
            for (const call of toolCalls) {
              console.log(`[agent] ${call.toolName}(${JSON.stringify(call.input)})`);
            }
          }
        : undefined,
  });

  return { result, sources };
}
