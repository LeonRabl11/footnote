import 'server-only';
import { generateText } from 'ai';
import { google } from '@/lib/embeddings/provider';
import { GENERATION_MODEL } from '@/lib/embeddings/config';
import { buildPagedResult, type ExtractResult } from './extract';

// Marker, mit dem Gemini die Seiten trennt (siehe Prompt).
const PAGE_MARKER = '<<<PAGE>>>';

const OCR_PROMPT = `Du erhältst ein PDF-Dokument als Bild (gescannt, ohne Textebene).
Transkribiere den GESAMTEN sichtbaren Text der Dokumentseiten wörtlich.

Regeln:
- Trenne jede Seite mit einer eigenen Zeile, die NUR den Marker ${PAGE_MARKER} enthält.
- Gib AUSSCHLIESSLICH den transkribierten Text aus – keine Einleitung, keine
  Erklärungen, keine Markdown-Codeblöcke.
- Behalte die Lesereihenfolge bei (bei mehrspaltigem Layout von links nach rechts).
- Gib Tabellen als einfachen Text wieder.`;

/**
 * OCR für gescannte (Bild-)PDFs über die BESTEHENDE Google-Provider-Instanz und
 * GENERATION_MODEL (multimodal, generateText – kein Streaming).
 * Liefert dasselbe { text, pages }-Format wie die unpdf-Extraktion.
 * Bei leerem Ergebnis ist text === '' (Aufrufer lehnt dann ab).
 */
export async function ocrPdf(bytes: Uint8Array): Promise<ExtractResult> {
  const { text } = await generateText({
    model: google(GENERATION_MODEL),
    temperature: 0, // deterministische, wörtliche Transkription
    providerOptions: {
      // Hohe Medienauflösung für bessere OCR-Qualität.
      google: { mediaResolution: 'MEDIA_RESOLUTION_HIGH' },
    },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: OCR_PROMPT },
          { type: 'file', data: bytes, mediaType: 'application/pdf' },
        ],
      },
    ],
  });

  // Am Seiten-Marker splitten -> ein String pro Seite; trimmen, leere verwerfen.
  const pageTexts = text
    .split(PAGE_MARKER)
    .map((page) => page.trim())
    .filter((page) => page.length > 0);

  // Gleiches Format wie die normale PDF-Extraktion (Seiten join "\n" + Seiten-Map).
  return buildPagedResult(pageTexts);
}
