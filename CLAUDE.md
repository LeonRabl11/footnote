# Footnote

Footnote ist ein RAG-Wissensassistent, der Fragen aus der Dokumentation beantwortet und zu **jeder** Antwort die Quelle nennt.

## Stack

- Next.js 16 (App Router) + TypeScript
- SCSS Modules + zentrale Tokens-Datei (`src/styles/_tokens.scss`)
- next-intl 4 (Sprachen `de`, `en`)
- Drizzle ORM + Neon (Postgres, Serverless-Treiber)
- pgvector (Embeddings)
- Gemini API (Embeddings + Antworten)
- Zod (Validierung)

## Befehle

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck`
- `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:studio`

## Konventionen (harte Regeln)

- **Tokens:** Alle Farben/Abstände/Größen kommen aus `_tokens.scss` (als `var(--…)`). Keine festen Werte in Komponenten.
- **i18n:** Alle nutzersichtbaren Texte über next-intl. Kein hartkodierter Text.
- **DB:** Jeder Datenbankzugriff über den Drizzle-Client (`src/lib/db`). Alle externen Eingaben mit Zod validieren.
- **Secrets:** Nur über Umgebungsvariablen (siehe `src/lib/env.ts` / `.env.example`). Niemals in Code oder Repo.

## Konventionen (sonstiges)

- Paketmanager ist `pnpm`.
- Next 16: Locale-Routing liegt in `src/proxy.ts` (ersetzt `middleware.ts`).
- App-Routen unter `src/app/[locale]/`.

## Projekt-Leitplanken (für spätere Schritte)

- **Genau EIN** Gemini-Embedding-Modell durchgängig: **`gemini-embedding-001`**, **1536** Dimensionen, Distanz **Cosine**. Niemals mischen, sonst sind die Vektoren inkompatibel. Single Source of Truth: `src/lib/embeddings/config.ts` – Modell/Länge stehen nur dort.
- Die Embedding-Spalte ist `vector(1536)`; der HNSW-Index nutzt `vector_cosine_ops` (passend zum Cosine-Operator `<=>`). Änderung der Länge/des Modells = alle Embeddings neu erzeugen + neue Migration.
- **Ingestion ist alles-oder-nichts** in EINER Transaktion.
- Antworten **ausschließlich** aus den abgerufenen Stücken, **immer mit Quellenangabe**. Sonst: „steht nicht in der Wissensbasis“.

## Aktueller Stand

Grundgerüst + DB-Schema. `src/lib/db/schema.ts` definiert `documents` und `chunks` (mit `vector(1536)` + HNSW/cosine); erste Migration unter `drizzle/0000_*.sql` generiert (noch nicht angewendet). Ingestion/Embedding/Retrieval-Logik fehlt noch.
