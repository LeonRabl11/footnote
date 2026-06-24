import 'server-only';
import { embedMany } from 'ai';
import { google } from './provider';
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from './config';

// Gemini-Task-Typen: Dokumente beim Einlesen, Queries bei der Suche.
export type EmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

// L2-Normalisierung: bei outputDimensionality < 3072 liefert
// gemini-embedding-001 nicht zwingend normalisierte Vektoren. Für Cosine-
// Suche normalisieren wir selbst auf Länge 1.
function l2Normalize(vector: number[]): number[] {
  let sumSquares = 0;
  for (const value of vector) sumSquares += value * value;
  const norm = Math.sqrt(sumSquares);
  if (norm === 0) return vector; // Null-Vektor unverändert lassen
  return vector.map((value) => value / norm);
}

/**
 * Bettet eine Liste von Texten mit gemini-embedding-001 ein.
 * - Direkter Provider + outputDimensionality aus config.ts (Single Source).
 * - Jeder Vektor wird L2-normalisiert.
 * - Schutzprüfung: jeder Vektor MUSS exakt EMBEDDING_DIMENSIONS Werte haben.
 */
export async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType = 'RETRIEVAL_DOCUMENT',
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const { embeddings } = await embedMany({
    model: google.embedding(EMBEDDING_MODEL),
    values: texts,
    // Tageslimit schonen: moderate Retries, begrenzte Parallelität.
    maxRetries: 2,
    maxParallelCalls: 2,
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType,
      },
    },
  });

  return embeddings.map((embedding, i) => {
    // Fängt den outputDimensionality-Bug früh ab (z. B. wenn der direkte
    // Provider nicht greift und das Modell 3072 Dimensionen zurückgibt).
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding ${i} hat ${embedding.length} Dimensionen, erwartet ` +
          `${EMBEDDING_DIMENSIONS}. outputDimensionality wurde vermutlich ignoriert.`,
      );
    }
    return l2Normalize(embedding);
  });
}
