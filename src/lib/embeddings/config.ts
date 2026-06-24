// ============================================================================
// EINZIGE Quelle der Wahrheit für die Embedding-Konfiguration.
// Modell und Vektor-Länge stehen NUR hier. Schema und (später) Ingestion/
// Retrieval importieren diese Konstanten – niemals fest eingetippte Werte.
//
// WICHTIG: Vektoren verschiedener Modelle sind nicht vergleichbar. Wird das
// Modell oder die Länge geändert, müssen alle vorhandenen Embeddings neu
// erzeugt werden (und das DB-Schema/Migration angepasst werden).
//
// Hinweis für später (jetzt nicht umsetzen):
// gemini-embedding-001 verarbeitet max. 2048 Input-Tokens; unsere Chunks
// (~500-800 Tokens) liegen sicher darunter. Bei einer Dimensions-Wahl unter
// 3072 (hier 1536) liefert das Modell ggf. nicht normalisierte Vektoren –
// die Embeddings sollten dann vor dem Speichern L2-normalisiert werden.
// ============================================================================

export const EMBEDDING_MODEL = 'gemini-embedding-001' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;
export const EMBEDDING_DISTANCE = 'cosine' as const;

// Generierungs-Modell (Single Source of Truth). gemini-3.5-flash ist das
// aktuelle stabile Flash-Modell und im Free-Tier nutzbar (Stand: 2026-06).
export const GENERATION_MODEL = 'gemini-3.5-flash' as const;
