import 'server-only';
import { cosineDistance, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chunks, documents } from '@/lib/db/schema';
import { embedTexts } from '@/lib/embeddings/embed';

export type RetrievalHit = {
  chunkId: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  documentTitle: string;
  documentSource: string;
  similarity: number; // 1 - Cosine-Distanz, nur zur Anzeige/Debug
};

/**
 * Vektor-Suche: bettet die Query ein (asymmetrisch, RETRIEVAL_QUERY) und holt
 * die topK ähnlichsten Chunks inkl. Dokument-Metadaten.
 */
export async function retrieve(query: string, topK = 5): Promise<RetrievalHit[]> {
  // Bestehende Embedding-Funktion wiederverwenden – nur anderer taskType.
  const [queryEmbedding] = await embedTexts([query], 'RETRIEVAL_QUERY');

  const distance = cosineDistance(chunks.embedding, queryEmbedding);
  const similarity = sql<number>`1 - (${distance})`;

  return db
    .select({
      chunkId: chunks.id,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
      documentId: documents.id,
      documentTitle: documents.title,
      documentSource: documents.source,
      similarity,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    // Nach ROHER Distanz aufsteigend sortieren -> Postgres kann den HNSW-Index
    // nutzen. NICHT nach desc(1 - distance), das würde den Index umgehen.
    .orderBy(distance)
    .limit(topK);
}
