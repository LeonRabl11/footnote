// Eigener Promptfoo-Provider für die REINE Such-Eval (Meilenstein 4 / Schritt 1).
// Misst nur das Retrieval: Findet die Hybrid-Suche die richtige Stelle?
// Es gibt KEINE KI-Antwort, KEINEN Richter und KEINEN zweiten Anbieter.
//
// Wichtig:
// - .env wird hier geladen (dotenv/config), damit DATABASE_URL (DB) und
//   GEMINI_API_KEY (Query-Embedding) verfügbar sind.
// - Die bestehende retrieve()-Funktion wird NUR aufgerufen, nicht verändert.
// - Relativer Import-Pfad (kein @/-Alias) für stabile Auflösung außerhalb von Next.
import 'dotenv/config';
import { retrieve, type RetrievalHit } from '../src/lib/retrieval/retrieve';

// Promptfoo-Provider-Vertrag (v0.121): Default-Export einer Klasse mit id()
// und async callApi(prompt, context?, options?) -> ProviderResponse ({ output }).
export default class RetrievalProvider {
  id(): string {
    return 'footnote-retrieval';
  }

  // prompt = die durchgereichte Frage (Prompt-Template '{{query}}').
  async callApi(prompt: string): Promise<{ output: string }> {
    const hits: RetrievalHit[] = await retrieve(prompt);

    // Ausgabe enthält pro Treffer Dokumenttitel UND Inhalt, damit die
    // icontains-Assertions sowohl auf den Titel (expected_source) als auch
    // auf einen Inhaltsschnipsel (expected_snippet) matchen können.
    const output = hits
      .map(
        (hit, i) =>
          `#${i + 1} [${hit.documentTitle} · S.${hit.page ?? '-'}/Z.${hit.line ?? '-'}]\n${hit.content}`,
      )
      .join('\n\n---\n\n');

    return { output };
  }
}
