// Text-Extraktion aus rohen Datei-Bytes. Bewusst verzweigt nach Dateityp,
// damit neue Typen später nur einen Zweig ergänzen – Chunking, Embedding und
// Speichern bleiben dateityp-unabhängig.
//
// WICHTIG: extract bekommt immer die ROHEN Bytes. .md/.txt werden hier als
// UTF-8 dekodiert; .pdf wird aus den Bytes per unpdf SEITENWEISE extrahiert.
// Der Chunker arbeitet später auf GENAU dem hier gebauten `text`, damit die
// charStart/charEnd der Chunks zur Seiten-Map passen.

import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';

export type SourceType = 'md' | 'txt' | 'pdf';

// Eine PDF-Seite mit ihren Zeichen-Positionen im zusammengefügten Volltext.
export type PageSpan = { pageNumber: number; charStart: number; charEnd: number };

export type ExtractResult = {
  text: string;
  pages: PageSpan[]; // leer für .md/.txt (keine Seiten)
};

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
// überflüssige Spaces/Tabs zusammenfassen, max. eine Leerzeile als Absatztrenner.
function normalizePdfText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Seitenweise extrahieren und Volltext + Seiten-Map bauen. Die Seiten werden
// mit "\n" verbunden; jede PageSpan beschreibt den Bereich [charStart, charEnd)
// ihrer Seite im zusammengefügten Text.
async function extractPdf(bytes: Uint8Array): Promise<ExtractResult> {
  // Bundled serverless-Build von PDF.js (Default – kein eigener pdfjs/canvas).
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractPdfText(pdf, { mergePages: false }); // string[]
  const pageTexts = text.map(normalizePdfText);

  const pages: PageSpan[] = [];
  let cursor = 0;
  for (let i = 0; i < pageTexts.length; i++) {
    const charStart = cursor;
    const charEnd = charStart + pageTexts[i].length;
    pages.push({ pageNumber: i + 1, charStart, charEnd });
    cursor = charEnd + 1; // +1 für den "\n"-Trenner zwischen den Seiten
  }

  return { text: pageTexts.join('\n'), pages };
}

export async function extractText(bytes: Uint8Array, sourceType: string): Promise<ExtractResult> {
  switch (sourceType) {
    case 'md':
    case 'txt': {
      // .md wird wie Klartext behandelt – Markdown-Syntax bleibt erhalten.
      const text = utf8.decode(bytes);
      if (text.trim().length === 0) {
        throw new ExtractionError('empty', 'Kein auslesbarer Text in der Datei.');
      }
      return { text, pages: [] };
    }

    case 'pdf': {
      const result = await extractPdf(bytes);
      // Leerer/fast leerer Text bei PDFs deutet auf ein gescanntes Bild-PDF
      // ohne Textebene hin (kein OCR – wird abgelehnt).
      if (result.text.trim().length === 0) {
        throw new ExtractionError(
          'empty-or-scanned',
          'Kein auslesbarer Text – möglicherweise ein gescanntes PDF ohne Textebene.',
        );
      }
      return result;
    }

    default:
      throw new ExtractionError('unsupported-type', `Nicht unterstützter Dateityp: "${sourceType}".`);
  }
}

// Start-Position eines Chunks bestimmen: Seite (1-basiert, null für .md/.txt)
// und Zeile (1-basiert). Bei PDFs Zeile INNERHALB der Seite, sonst global.
export function locatePosition(
  fullText: string,
  pages: PageSpan[],
  charStart: number,
): { page: number | null; line: number } {
  const countNewlines = (from: number, to: number): number => {
    let count = 0;
    for (let i = from; i < to; i++) {
      if (fullText[i] === '\n') count++;
    }
    return count;
  };

  if (pages.length === 0) {
    // .md/.txt: globale Zeile vom Dateianfang.
    return { page: null, line: countNewlines(0, charStart) + 1 };
  }

  // PDF: letzte Seite, deren charStart <= chunkStart (robust auch an Trennern).
  let span = pages[0];
  for (const page of pages) {
    if (charStart >= page.charStart) span = page;
    else break;
  }
  return { page: span.pageNumber, line: countNewlines(span.charStart, charStart) + 1 };
}
