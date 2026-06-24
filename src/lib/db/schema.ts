// ============================================================================
// Drizzle-Schema für Footnote (Postgres + pgvector).
//
// Die Vektor-Länge kommt aus der Single Source of Truth in
// src/lib/embeddings/config.ts – KEINE fest eingetippte Zahl hier.
// ============================================================================

import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  vector,
  index,
} from 'drizzle-orm/pg-core';
import { EMBEDDING_DIMENSIONS } from '@/lib/embeddings/config';

// -- documents ---------------------------------------------------------------
// Ein eingelesenes Quelldokument.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  source: text('source').notNull(), // Herkunft: Dateiname oder URL
  sourceType: text('source_type').notNull(), // z. B. "md" | "txt" | "pdf"
  // Optional: Hash des Originalinhalts für spätere Dubletten-Prüfung.
  contentHash: text('content_hash'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// -- chunks ------------------------------------------------------------------
// Ein Stück eines Dokuments inkl. seines Embedding-Vektors.
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    // Vektor-Länge MUSS zum gewählten Gemini-Modell passen (siehe config.ts).
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }).notNull(),
    chunkIndex: integer('chunk_index').notNull(), // Reihenfolge im Dokument
    tokenCount: integer('token_count'),
    // Optional: Zeichen-Offsets für präzisere Quellen-Verweise.
    charStart: integer('char_start'),
    charEnd: integer('char_end'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    // HNSW-Index MIT vector_cosine_ops – nur damit nutzt der Cosine-Operator
    // (<=>) später den Index. Falsche Operatorklasse => stille Seq-Scans.
    index('chunks_embedding_hnsw_idx').using(
      'hnsw',
      table.embedding.op('vector_cosine_ops'),
    ),
    // Normaler Index auf documentId für Joins / kaskadierendes Löschen.
    index('chunks_document_id_idx').on(table.documentId),
  ],
);
