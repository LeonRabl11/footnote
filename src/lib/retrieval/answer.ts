import 'server-only';
import { streamText } from 'ai';
import { google } from '@/lib/embeddings/provider';
import { GENERATION_MODEL } from '@/lib/embeddings/config';
import { retrieve, type RetrievalHit } from './retrieve';

// Antwortet exakt mit diesem Satz, wenn der Kontext die Frage nicht hergibt.
export const NOT_IN_KNOWLEDGE_BASE = 'Das steht nicht in der Wissensbasis.';

// Strenger Grounding-Prompt. Die "nicht in der Wissensbasis"-Garantie kommt
// bewusst aus DIESER Anweisung, NICHT aus einem Similarity-Schwellenwert.
const SYSTEM_PROMPT = `Du bist der Wissensassistent "Footnote".
Beantworte die Frage AUSSCHLIESSLICH auf Grundlage des bereitgestellten Kontexts.
Nutze KEIN externes Wissen und rate nicht.

Regeln:
- Stütze jede Aussage nur auf den Kontext.
- Nenne die Quelle (Dokumenttitel), auf die du dich stützt.
- Steht die Antwort nicht im Kontext, antworte exakt mit: "${NOT_IN_KNOWLEDGE_BASE}"
- Antworte in der Sprache der Frage.
- Erfinde nichts und nenne keine Quellen, die nicht im Kontext stehen.`;

export type AnswerSource = {
  documentId: string;
  documentTitle: string;
  documentSource: string;
};

function dedupeSources(hits: RetrievalHit[]): AnswerSource[] {
  const seen = new Set<string>();
  const sources: AnswerSource[] = [];
  for (const hit of hits) {
    if (seen.has(hit.documentId)) continue;
    seen.add(hit.documentId);
    sources.push({
      documentId: hit.documentId,
      documentTitle: hit.documentTitle,
      documentSource: hit.documentSource,
    });
  }
  return sources;
}

function buildContext(hits: RetrievalHit[]): string {
  return hits
    .map((hit) => `[Quelle: ${hit.documentTitle}]\n${hit.content}`)
    .join('\n\n---\n\n');
}

/**
 * Holt passende Chunks und lässt Gemini Flash eine belegte Antwort streamen,
 * die NUR aus diesen Chunks schöpft. Gibt Stream + (dedup.) Quellen zurück;
 * `hits` ist für Debug/Anzeige der Treffer-Details enthalten.
 */
export async function answer(query: string) {
  const hits = await retrieve(query);

  const context = buildContext(hits);
  const prompt = `Kontext:\n\n${context}\n\nFrage: ${query}`;

  const result = streamText({
    model: google(GENERATION_MODEL),
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.2,
  });

  return { result, sources: dedupeSources(hits), hits };
}
