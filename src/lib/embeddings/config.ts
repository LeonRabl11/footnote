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

// Generierungs-Modelle (Single Source of Truth), GEORDNET nach Präferenz.
// Das AI SDK hat KEINEN eingebauten Modell-Array-Fallback – die Schleife, die
// bei erschöpftem Free-Tier-Kontingent (429) das nächste Modell versucht, ist
// in answer.ts selbst gebaut. Alle Einträge sind Free-Tier-Flash-Modelle.
export const GENERATION_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash-lite',
] as const;
