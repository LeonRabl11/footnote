# Footnote

**An agentic RAG knowledge assistant that answers questions _only_ from your uploaded documents — and backs every answer with a precise source (file, page, line).**

If the answer isn't in the knowledge base, Footnote says so instead of guessing.

---

## What it does

- **Upload documents** — Markdown, plain text, and PDFs, including scanned PDFs (handled via OCR).
- **Ask questions** in natural language (German or English).
- **Get grounded answers** with a citation for every claim — document title, page, and line.
- **Honest refusals** — for off-topic questions it replies *"Das steht nicht in der Wissensbasis."* ("not in the knowledge base") rather than hallucinating.

---

## Architecture

Two distinct flows: offline **ingestion** of documents, and online **querying** via an agentic loop.

```mermaid
flowchart TD
    subgraph Ingestion
        A[File: md / txt / pdf] --> B{Extract}
        B -->|text PDF via unpdf,<br/>page-wise| C[Page-mapped text]
        B -->|scanned PDF| O[Gemini multimodal OCR]
        O --> C
        B -->|md / txt| C
        C --> D[Chunk<br/>~700 tokens, 12% overlap]
        D --> E[Embed<br/>gemini-embedding-001, 1536d]
        E --> F[(Postgres + pgvector<br/>HNSW cosine + tsvector GIN)]
    end

    subgraph Query
        Q[Question] --> L[Agentic loop<br/>streamText + stopWhen]
        L -->|calls tool| S[Hybrid search<br/>vector + full-text, RRF]
        S --> F
        F --> S
        S -->|passages + sources| L
        L --> R[Grounded answer<br/>+ citations]
    end
```

---

## Tech stack

| Area | Choice |
|------|--------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Database | Neon Postgres (serverless driver) + [pgvector](https://github.com/pgvector/pgvector) |
| ORM | Drizzle ORM + drizzle-kit |
| AI orchestration | Vercel AI SDK 6 (`ai`, `@ai-sdk/google`, `@ai-sdk/react`) |
| Models | Google Gemini — generation, embeddings, and multimodal OCR |
| i18n | next-intl (`de`, `en`) |
| Evals | Promptfoo |
| Observability | Langfuse via OpenTelemetry |

---

## Key design decisions

The interesting part isn't the feature list — it's *why* each piece works the way it does.

**1536-dimension embeddings (Matryoshka truncation).**
`gemini-embedding-001` is truncated from its native size to 1536 dimensions. This stays under pgvector's HNSW index limit of 2000 dimensions — which a full-size vector would exceed, forcing slow exact scans — while preserving nearly all retrieval quality. Distance metric is cosine throughout; the model and length live in a single source of truth (`src/lib/embeddings/config.ts`), because vectors from different models or lengths are not comparable.

**Retrieval ordered by raw cosine distance, ascending.**
The vector query sorts by the raw distance operator ascending (`ORDER BY embedding <=> query`). This is deliberate: Postgres only uses the HNSW index for this exact shape. Sorting by `1 - distance` descending (the intuitive "most similar first") silently falls back to a sequential scan — correct results, but the index goes unused.

**Hybrid search fused with Reciprocal Rank Fusion.**
Two searches run in parallel: semantic (pgvector) and full-text (Postgres `tsvector`). They're merged with RRF (`k = 60`). Semantic search catches paraphrases and typos; full-text catches exact terms, names, and numbers that embeddings blur. RRF combines them by rank, so it needs **no weight tuning** between two scores on incompatible scales. The full-text side uses the `'simple'` configuration — no language-specific stemming — because the corpus mixes German and English; query and indexed column must use the same config or the GIN index isn't used.

**Agentic tool-calling, not a fixed pipeline.**
Search is exposed as a *tool* the model calls itself (AI SDK `tool` + `streamText`, bounded by `stopWhen: stepCountIs(4)`). This lets the model search once per sub-question on multi-part queries, and skip searching entirely when it shouldn't — with a hard step ceiling so a single request can't run away.

**Strict grounding.**
The answer is composed *only* from retrieved passages, each with its source. When nothing relevant is found, the model returns the exact sentence *"Das steht nicht in der Wissensbasis."* This guarantee comes from the system prompt, not a similarity threshold — an honest refusal beats a confident hallucination.

**Precise citations.**
Page and line for each chunk are derived from character offsets mapped against a per-page span map. PDFs are extracted **page by page** (`mergePages: false`) specifically to preserve page boundaries; the same paged format is produced by the OCR path, so citations work identically for scanned documents.

**PDF & OCR built for serverless.**
Text PDFs are parsed with [unpdf](https://github.com/unjs/unpdf) — a bundled PDF.js build with **no native dependencies**, so it runs on Vercel where `pdf-parse`/Tesseract typically break. Scanned (image-only) PDFs fall back to **Gemini's multimodal OCR**, reusing the model already in the stack (free-tier multimodal) with explicit page markers to keep page boundaries intact.

**Model fallback across free tiers.**
Generation uses an ordered list of free Gemini Flash models (`gemini-2.5-flash` → `gemini-3.5-flash` → `gemini-2.5-flash-lite`). On a quota error (HTTP 429 / `RESOURCE_EXHAUSTED`) the whole run is retried with the next model — effectively pooling several separate free-tier daily quotas into one. *Honest caveat:* the AI SDK has no built-in array fallback, so this is hand-rolled and only switches cleanly when the error surfaces at stream start; an error mid-stream surfaces normally (streams aren't replayable).

**Two-sided evals.**
A **retrieval eval** checks whether search returns the right passage — cheap, deterministic, no model judge. A **faithfulness eval** uses LLM-as-judge over a *separate* free provider (OpenRouter), so judging never spends the Gemini quota. The faithfulness set includes off-topic questions to verify the refusal behavior.

**Observability.**
Langfuse is wired in via OpenTelemetry. Per request it surfaces the tool calls the model made, which model actually answered (relevant when the fallback kicks in), latency, and token usage.

**CI.**
GitHub Actions runs the retrieval eval on every push (the faithfulness eval is excluded to preserve quota).

**Built entirely on $0 / free tiers** — Neon, Gemini, OpenRouter, and Langfuse free plans.

---

## Getting started

### Prerequisites

- **Node.js 20+** (CI uses 22) and **pnpm**
- A **Neon Postgres** database with the **pgvector** extension enabled
- A **Google Gemini API key**

### Environment

Copy `.env.example` to `.env` and fill in your values (placeholders shown):

```bash
# Required
DATABASE_URL="postgresql://user:password@host.neon.tech/footnote?sslmode=require"
GEMINI_API_KEY="your-gemini-api-key"

# Optional — only for the faithfulness eval (LLM-as-judge)
OPENROUTER_API_KEY="your-openrouter-key"

# Optional — Langfuse tracing
LANGFUSE_PUBLIC_KEY="pk-lf-..."
LANGFUSE_SECRET_KEY="sk-lf-..."
LANGFUSE_BASE_URL="https://cloud.langfuse.com"
```

Only `DATABASE_URL` and `GEMINI_API_KEY` are required; the app runs without the optional keys.

### Run

```bash
pnpm install
pnpm db:migrate     # create tables, pgvector column, HNSW + GIN indexes
pnpm dev            # start the app (chat UI on the home page)
```

Then open the app, go to `/ingest` to upload documents, and ask questions on the home page.

---

## Evals

Both evals are [Promptfoo](https://www.promptfoo.dev/) configs that call the real pipeline.

| Eval | What it measures | Command |
|------|------------------|---------|
| **Retrieval** | Does hybrid search return the expected passage for a gold question? Deterministic, no model judge. | `pnpm run eval` |
| **Faithfulness** | Does the generated answer stay faithful to the sources (and correctly refuse off-topic questions)? LLM-as-judge via OpenRouter. | `pnpm run eval:answer` |

---

## Project structure

```
src/
  app/
    [locale]/
      page.tsx           # chat UI (home)
      ingest/page.tsx    # document upload
    api/chat/route.ts    # streaming chat endpoint (Node runtime)
  instrumentation.ts     # Langfuse / OpenTelemetry tracing setup
  lib/
    ingestion/           # extract (unpdf) · OCR · chunk · embed · store
    retrieval/           # hybrid search (RRF) · search tool · agentic answer
    embeddings/          # model config (single source of truth) · provider
    db/                  # Drizzle client + schema
evals/                   # retrieval + faithfulness Promptfoo configs & providers
.github/workflows/       # CI: retrieval eval on every push
```

---

## Limitations & notes

- **Throughput is bounded by free-tier quotas.** The ordered model fallback softens this by pooling several daily allowances, but sustained high volume needs a paid tier.
- **OCR page numbers are reliable; line-within-page is approximate** for multi-column or table-heavy layouts, where reading order can't always be recovered exactly from a flat transcription.
- **The retrieval eval is a regression guard**, not a benchmark — its signal grows with the size and diversity of the gold set as the corpus expands.
