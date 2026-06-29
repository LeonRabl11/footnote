import 'server-only';
import { and, cosineDistance, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chunks, documents, chatDocuments } from '@/lib/db/schema';
import { embedTexts } from '@/lib/embeddings/embed';

export type RetrievalHit = {
  chunkId: string;
  content: string;
  chunkIndex: number;
  documentId: string;
  documentTitle: string;
  documentSource: string;
  documentSourceType: string; // "md" | "txt" | "pdf"
  page: number | null; // Start-Seite (null für .md/.txt)
  line: number | null; // Start-Zeile
  similarity: number; // Score der jeweiligen Einzelsuche, nur zur Anzeige/Debug
};

// Kandidaten pro Einzelsuche (genug Material für die Fusion).
const CANDIDATES = 20;
// RRF-Konstante (gängiger Standardwert).
const RRF_K = 60;

// Gemeinsame Felder für beide Suchen – sichert identisches Trefferformat.
const SELECT_FIELDS = {
  chunkId: chunks.id,
  content: chunks.content,
  chunkIndex: chunks.chunkIndex,
  documentId: documents.id,
  documentTitle: documents.title,
  documentSource: documents.source,
  documentSourceType: documents.sourceType,
  page: chunks.page,
  line: chunks.line,
};

/**
 * Bedeutungs-Suche (Vektor). Asymmetrisch (RETRIEVAL_QUERY), ~CANDIDATES Treffer.
 * Mit `chatId` werden NUR Chunks berücksichtigt, deren Dokument über
 * chat_documents zu diesem Chat gehört (Join chunks -> documents -> chat_documents).
 */
async function vectorSearch(query: string, chatId?: string): Promise<RetrievalHit[]> {
  // Bestehende Embedding-Funktion wiederverwenden – nur anderer taskType.
  const [queryEmbedding] = await embedTexts([query], 'RETRIEVAL_QUERY');
  const distance = cosineDistance(chunks.embedding, queryEmbedding);

  const base = db
    .select({ ...SELECT_FIELDS, similarity: sql<number>`1 - (${distance})` })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .$dynamic();

  // Chat-Filter NUR ergänzen, wenn chatId gesetzt ist. Die Sortierung bleibt
  // unverändert nach ROHER Distanz aufsteigend -> Postgres nutzt den HNSW-Index.
  const scoped = chatId
    ? base
        .innerJoin(chatDocuments, eq(chatDocuments.documentId, documents.id))
        .where(eq(chatDocuments.chatId, chatId))
    : base;

  return scoped.orderBy(distance).limit(CANDIDATES);
}

/**
 * Wort-Suche (Postgres-Volltext). Konfiguration 'simple' wie in der generierten
 * Spalte (sonst kein GIN-Index). websearch_to_tsquery verträgt beliebige Eingaben.
 * Mit `chatId` analog auf die Dokumente dieses Chats eingeschränkt.
 */
async function keywordSearch(query: string, chatId?: string): Promise<RetrievalHit[]> {
  const tsquery = sql`websearch_to_tsquery('simple', ${query})`;
  const rank = sql<number>`ts_rank(${chunks.contentSearch}, ${tsquery})`;
  const matches = sql`${chunks.contentSearch} @@ ${tsquery}`;

  const base = db
    .select({ ...SELECT_FIELDS, similarity: rank })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .$dynamic();

  const scoped = chatId
    ? base
        .innerJoin(chatDocuments, eq(chatDocuments.documentId, documents.id))
        .where(and(matches, eq(chatDocuments.chatId, chatId)))
    : base.where(matches);

  return scoped.orderBy(desc(rank)).limit(CANDIDATES);
}

/**
 * Reciprocal Rank Fusion: Score je Chunk = Summe über beide Listen von
 * 1 / (k + rang) (1-basierter Rang). Chunks aus nur einer Liste erhalten den
 * Score nur daraus. Top-topK nach Score absteigend.
 */
function fuse(
  vectorHits: RetrievalHit[],
  keywordHits: RetrievalHit[],
  topK: number,
): RetrievalHit[] {
  const scores = new Map<string, number>();
  const hitById = new Map<string, RetrievalHit>();

  const accumulate = (hits: RetrievalHit[]) => {
    hits.forEach((hit, i) => {
      const rank = i + 1;
      scores.set(hit.chunkId, (scores.get(hit.chunkId) ?? 0) + 1 / (RRF_K + rank));
      // Vektor-Treffer zuerst -> dessen Objekt (Cosine-similarity) bleibt repräsentativ.
      if (!hitById.has(hit.chunkId)) hitById.set(hit.chunkId, hit);
    });
  };

  accumulate(vectorHits);
  accumulate(keywordHits);

  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([chunkId]) => hitById.get(chunkId)!);
}

/**
 * Hybrid-Suche: Vektor- und Wort-Suche parallel, dann RRF-Fusion. Rückgabe-
 * Format unverändert (answer.ts merkt nichts) – es ändert sich nur, WELCHE
 * Chunks geliefert werden.
 *
 * `chatId` schränkt BEIDE Teilsuchen auf die Dokumente dieses Chats ein. Hat der
 * Chat keine Dokumente, liefern beide Suchen leer -> Fusion leer -> der agentic
 * Loop antwortet korrekt mit "Das steht nicht in der Wissensbasis.".
 * Ohne `chatId` (z. B. in den Evals) bleibt das bisherige globale Verhalten.
 */
export async function retrieve(
  query: string,
  chatId?: string,
  topK = 5,
): Promise<RetrievalHit[]> {
  const [vectorHits, keywordHits] = await Promise.all([
    vectorSearch(query, chatId),
    keywordSearch(query, chatId),
  ]);

  const fused = fuse(vectorHits, keywordHits, topK);

  if (process.env.NODE_ENV !== 'production') {
    const fmt = (hits: RetrievalHit[]) =>
      hits.map((h, i) => `${i + 1}. ${h.documentTitle}#${h.chunkIndex}`);
    console.log('[retrieve] vektor :', fmt(vectorHits));
    console.log('[retrieve] keyword:', fmt(keywordHits));
    console.log('[retrieve] fusion :', fmt(fused));
  }

  return fused;
}
