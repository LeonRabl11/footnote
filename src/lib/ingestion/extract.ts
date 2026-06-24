// Text-Extraktion aus rohen Datei-Bytes. Bewusst verzweigt nach Dateityp,
// damit neue Typen später nur einen Zweig ergänzen – Chunking, Embedding und
// Speichern bleiben dateityp-unabhängig.
//
// WICHTIG: extract bekommt immer die ROHEN Bytes. .md/.txt werden hier als
// UTF-8 dekodiert; .pdf wird aus den Bytes per unpdf extrahiert (kein vorher
// dekodierter String).

import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

export type SourceType = 'md' | 'txt' | 'pdf';

// Codes statt fertiger Texte – die UI übersetzt sie über next-intl.
export type ExtractionErrorCode = 'empty' | 'empty-or-scanned' | 'unsupported-type';

export class ExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  constructor(code: ExtractionErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const utf8 = new TextDecoder('utf-8', { fatal: false });

// Leichte Normalisierung des PDF-Texts für bessere Chunk-Qualität: CRLF -> LF,
// überflüssige Spaces/Tabs zusammenfassen, max. eine Leerzeile als Absatztrenner
// (Absatzstruktur für das Chunking bleibt erhalten).
function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string> {
  // Bundled serverless-Build von PDF.js (Default – kein eigener pdfjs/canvas).
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractPdfText(pdf, { mergePages: true });
  return normalizePdfText(text);
}

export async function extractText(bytes: Uint8Array, sourceType: string): Promise<string> {
  switch (sourceType) {
    case 'md':
    case 'txt': {
      // .md wird wie Klartext behandelt – Markdown-Syntax bleibt erhalten.
      const text = utf8.decode(bytes);
      if (text.trim().length === 0) {
        throw new ExtractionError('empty', 'Kein auslesbarer Text in der Datei.');
      }
      return text;
    }

    case 'pdf': {
      const text = await extractPdf(bytes);
      // Leerer/fast leerer Text bei PDFs deutet auf ein gescanntes Bild-PDF
      // ohne Textebene hin (kein OCR – wird abgelehnt).
      if (text.trim().length === 0) {
        throw new ExtractionError(
          'empty-or-scanned',
          'Kein auslesbarer Text – möglicherweise ein gescanntes PDF ohne Textebene.',
        );
      }
      return text;
    }

    default:
      throw new ExtractionError('unsupported-type', `Nicht unterstützter Dateityp: "${sourceType}".`);
  }
}
