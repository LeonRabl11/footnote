// Promptfoo-Provider für die Treue-Eval (Meilenstein 4 / Schritt 2).
// Misst die ANTWORT-Hälfte: Hält sich Footnotes Antwort treu an die Quellen?
// Ruft die ECHTE agentic answer()-Pipeline auf (Retrieval + Grounding-Prompt +
// Gemini-Generierung inkl. Modell-Fallback). answer() wird NUR aufgerufen.
// Der Richter (LLM-as-Judge) läuft separat über OpenRouter – siehe Config.
import 'dotenv/config';
import type { UIMessage } from 'ai';
import { answer } from '../src/lib/retrieval/answer';

// answer() liefert keinen fertigen Text, sondern result.toUIMessageStreamResponse()
// (ein gestreamtes SSE-Response im UI-Message-Stream-Protokoll). Wir konsumieren
// den Stream vollständig und setzen den Antworttext aus den text-delta-Chunks
// zusammen. Chunk-Formen (AI SDK): { type:'text-delta', delta } / { type:'error', errorText }.
function extractText(sse: string): { text: string; errorText?: string } {
  let text = '';
  let errorText: string | undefined;
  for (const line of sse.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const payload = trimmed.slice('data:'.length).trim();
    if (!payload || payload === '[DONE]') continue;
    let chunk: { type?: string; delta?: string; errorText?: string };
    try {
      chunk = JSON.parse(payload);
    } catch {
      continue; // unvollständige/nicht-JSON-Zeile überspringen
    }
    if (chunk.type === 'text-delta' && typeof chunk.delta === 'string') {
      text += chunk.delta;
    } else if (chunk.type === 'error' && typeof chunk.errorText === 'string') {
      errorText = chunk.errorText;
    }
  }
  return { text, errorText };
}

export default class AnswerProvider {
  id(): string {
    return 'footnote-answer';
  }

  // prompt = die Frage. Minimale UIMessage-Liste -> echte Pipeline -> Antworttext.
  async callApi(prompt: string): Promise<{ output?: string; error?: string }> {
    const messages: UIMessage[] = [
      { id: 'eval-user', role: 'user', parts: [{ type: 'text', text: prompt }] },
    ];

    const { result } = await answer(messages);
    const response = await result.toUIMessageStreamResponse();

    // Nicht-200 = z. B. 503 'quota-exhausted' (alle Gemini-Modelle erschöpft).
    if (!response.ok) {
      const body = await response.text();
      return { error: `answer() lieferte HTTP ${response.status}: ${body}` };
    }

    const { text, errorText } = extractText(await response.text());
    if (!text && errorText) return { error: errorText };
    return { output: text };
  }
}
