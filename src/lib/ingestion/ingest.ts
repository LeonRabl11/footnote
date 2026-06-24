import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, chunks } from '@/lib/db/schema';
import { embedTexts } from '@/lib/embeddings/embed';
import { extractText, ExtractionError } from './extract';
import { chunkText } from './chunk';

export type IngestInput = {
  bytes: Uint8Array;
  title: string;
  source: string; // Dateiname oder URL
  sourceType: string; // "md" | "txt" | "pdf"
};

export type IngestResult =
  | { status: 'created'; documentId: string; chunkCount: number }
  | { status: 'exists'; documentId: string; chunkCount: number }
  | { status: 'error'; message: string };

export async function ingest(input: IngestInput): Promise<IngestResult> {
  // 1. Extrahieren (kann mit ExtractionError abbrechen).
  let text: string;
  try {
    text = extractText(input.bytes, input.sourceType);
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { status: 'error', message: error.message };
    }
    throw error;
  }

  // 2. Dedup über contentHash – schon vorhanden? Dann nicht neu einlesen.
  const contentHash = createHash('sha256').update(text, 'utf8').digest('hex');
  const existing = await db
    .select({ id: documents.id })
    .from(documents)
    .where(eq(documents.contentHash, contentHash))
    .limit(1);

  if (existing.length > 0) {
    const documentId = existing[0].id;
    const existingChunks = await db
      .select({ id: chunks.id })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));
    return { status: 'exists', documentId, chunkCount: existingChunks.length };
  }

  // 3. Chunken.
  const chunkList = chunkText(text);
  if (chunkList.length === 0) {
    return { status: 'error', message: 'Kein auslesbarer Text nach dem Chunking.' };
  }

  // 4. Embedden (RETRIEVAL_DOCUMENT). Schlägt embed fehl, wird unten nichts gespeichert.
  let embeddings: number[][];
  try {
    embeddings = await embedTexts(chunkList.map((c) => c.content), 'RETRIEVAL_DOCUMENT');
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Embedding fehlgeschlagen.',
    };
  }

  // 5. Speichern – alles-oder-nichts in EINER Transaktion.
  // documentId vorab erzeugen, damit die chunks ihn ohne RETURNING referenzieren
  // können (kompatibel mit dem Neon-HTTP-Treiber).
  const documentId = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(documents).values({
      id: documentId,
      title: input.title,
      source: input.source,
      sourceType: input.sourceType,
      contentHash,
    });

    await tx.insert(chunks).values(
      chunkList.map((c, i) => ({
        documentId,
        content: c.content,
        embedding: embeddings[i],
        chunkIndex: c.chunkIndex,
        tokenCount: c.tokenCount,
        charStart: c.charStart,
        charEnd: c.charEnd,
      })),
    );
  });

  return { status: 'created', documentId, chunkCount: chunkList.length };
}
