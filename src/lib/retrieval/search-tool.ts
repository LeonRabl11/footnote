import 'server-only';
import { tool } from 'ai';
import { z } from 'zod';
import { retrieve } from './retrieve';
import type { AnswerSource } from './answer';

// Beschreibung als AUSLÖSEBEDINGUNG fürs Modell formuliert (nicht als Mechanik).
const TOOL_DESCRIPTION =
  'Durchsuche die Wissensbasis nach Passagen, die zur Frage passen. ' +
  'Nutze dies immer, wenn die Frage Faktenwissen aus den hochgeladenen Dokumenten ' +
  'benötigt. Bei mehrteiligen Fragen pro Teilfrage einmal suchen.';

/**
 * Erzeugt das Such-Werkzeug für GENAU einen Request samt anfrage-lokalem
 * Quellen-Sammler. Jede Tool-Ausführung nutzt die bestehende Hybrid-Suche und
 * pusht ihre Quellen (dedupliziert nach documentId+page+line) in `sources`.
 *
 * `chatId` schränkt die Suche auf die Wissensbasis dieses Chats ein (wird an
 * retrieve durchgereicht). Ohne chatId bleibt das globale Verhalten.
 */
export function createSearchTool(chatId?: string) {
  const sources: AnswerSource[] = [];
  const seen = new Set<string>();

  const searchKnowledgeBase = tool({
    description: TOOL_DESCRIPTION,
    inputSchema: z.object({
      query: z.string().describe('Die Suchanfrage bzw. Teilfrage in natürlicher Sprache.'),
    }),
    execute: async ({ query }) => {
      // Bestehende Hybrid-Retrieval-Funktion wiederverwenden – nicht neu bauen.
      const hits = await retrieve(query, chatId);

      for (const hit of hits) {
        const key = `${hit.documentId}:${hit.page}:${hit.line}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sources.push({
          documentId: hit.documentId,
          documentTitle: hit.documentTitle,
          documentSource: hit.documentSource,
          sourceType: hit.documentSourceType,
          page: hit.page,
          line: hit.line,
        });
      }

      // Passagen + Quelle ans Modell, damit es daraus antworten und zitieren kann.
      return hits.map((hit) => ({
        content: hit.content,
        source: {
          title: hit.documentTitle,
          page: hit.page,
          line: hit.line,
          documentId: hit.documentId,
        },
      }));
    },
  });

  return { searchKnowledgeBase, sources };
}
