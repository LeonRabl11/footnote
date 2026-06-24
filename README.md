# Footnote

**Footnote** ist ein RAG-Wissensassistent: Er beantwortet Fragen aus deiner
Dokumentation und gibt zu **jeder** Antwort die Quelle an. Steht etwas nicht in
der Wissensbasis, sagt Footnote das offen, statt zu raten.

Pipeline (Gesamtbild): Dokumente einlesen → in Stücke schneiden → als Embeddings
in Postgres/pgvector speichern → später Ähnlichkeitssuche + KI-Antwort mit
Quellenangabe.

> Status: **Grundgerüst.** Tooling und Struktur stehen. Datenbank-Tabellen
> (`documents`, `chunks`) und die Funktionslogik (Ingestion, Retrieval,
> Embeddings) folgen in späteren Schritten.

## Stack

- **Next.js 16** (App Router) + **TypeScript**
- **SCSS Modules** + zentrale Tokens-Datei (`src/styles/_tokens.scss`)
- **next-intl 4** (Sprachen: `de`, `en`)
- **Drizzle ORM** + **Neon** (Postgres, Serverless-Treiber)
- **pgvector** für Embeddings (im nächsten Schritt)
- **Gemini API** für Embeddings + Antworten
- **Zod** für Eingabe-/Env-Validierung

## Projektstruktur

```
src/
  app/[locale]/      App-Router-Seiten (locale-aware)
  i18n/              next-intl: routing / request / navigation
  lib/
    db/              Drizzle-Client (index.ts) + Schema (schema.ts, noch leer)
    embeddings/      Platzhalter – Gemini-Embeddings
    ingestion/       Platzhalter – Einlesen/Chunking/Speichern
    retrieval/       Platzhalter – Ähnlichkeitssuche
    env.ts           typisiertes, validiertes Env-Modul (Zod)
  styles/            _tokens.scss + globals.scss
  proxy.ts           next-intl Locale-Routing (Next 16: ersetzt middleware.ts)
messages/            de.json / en.json (Übersetzungen)
drizzle/             generierte Migrationen
drizzle.config.ts    Drizzle-Kit-Konfiguration
```

## Setup

Voraussetzungen: Node 22+, `pnpm`.

```bash
pnpm install
cp .env.example .env      # Windows: Copy-Item .env.example .env
# .env mit echten Werten füllen (siehe unten)
pnpm dev                  # http://localhost:3000  -> leitet auf /de um
```

## Befehle

| Befehl              | Zweck                                   |
| ------------------- | --------------------------------------- |
| `pnpm dev`          | Dev-Server                              |
| `pnpm build`        | Produktions-Build                       |
| `pnpm start`        | Build starten                           |
| `pnpm lint`         | Linting                                 |
| `pnpm typecheck`    | TypeScript ohne Emit prüfen             |
| `pnpm db:generate`  | Migration aus dem Schema erzeugen       |
| `pnpm db:migrate`   | Migrationen anwenden                    |
| `pnpm db:push`      | Schema direkt pushen (Entwicklung)      |
| `pnpm db:studio`    | Drizzle Studio öffnen                   |

## Was du noch selbst tun musst

Diese Schritte brauchen echte Konten/Schlüssel und können nicht automatisiert
werden:

1. **Neon-Projekt erstellen** auf <https://neon.tech> und die Connection-URL
   kopieren.
2. **pgvector aktivieren**: in der Neon-SQL-Konsole `CREATE EXTENSION IF NOT
   EXISTS vector;` ausführen.
3. **Gemini-API-Key holen** im Google AI Studio: <https://aistudio.google.com>.
4. **`.env` befüllen**: `DATABASE_URL` und `GEMINI_API_KEY` mit den echten
   Werten eintragen (Datei ist gitignored).
5. **Lokal testen**: `pnpm install` und `pnpm dev`, dann `http://localhost:3000`
   öffnen.

> Erst danach geht es weiter mit: Embedding-Modell wählen → feste Vektor-Länge
> festlegen → `documents`/`chunks`-Schema anlegen → Migration generieren.
