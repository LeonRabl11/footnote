// Text-Extraktion aus rohen Datei-Bytes. Bewusst verzweigt nach Dateityp,
// damit neue Typen (pdf, ...) später nur einen Zweig ergänzen – Chunking,
// Embedding und Speichern bleiben dateityp-unabhängig.

export type SourceType = 'md' | 'txt' | 'pdf';

export class ExtractionError extends Error {}

const utf8 = new TextDecoder('utf-8', { fatal: false });

export function extractText(bytes: Uint8Array, sourceType: string): string {
  let text: string;

  switch (sourceType) {
    case 'md':
    case 'txt':
      // .md wird wie Klartext behandelt – Markdown-Syntax bleibt erhalten
      // (für Quellen-Treue beim späteren Chunking).
      text = utf8.decode(bytes);
      break;

    case 'pdf':
      // TODO: PDF-Extraktion kommt im nächsten Schritt.
      throw new ExtractionError('PDF kommt im nächsten Schritt – noch nicht unterstützt.');

    default:
      throw new ExtractionError(`Nicht unterstützter Dateityp: "${sourceType}".`);
  }

  // Leer oder fast nur Whitespace -> ablehnen.
  if (text.trim().length === 0) {
    throw new ExtractionError('Kein auslesbarer Text in der Datei.');
  }

  return text;
}
