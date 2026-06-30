# Footnote

**An agentic RAG knowledge assistant that answers questions _only_ from your uploaded documents — and backs every answer with a precise source (file, page, line).**

If the answer isn't in the knowledge base, Footnote says so instead of guessing.

<!--
  SCREENSHOTS — add two images under a top-level `docs/` folder:
  • docs/answer.png  → a grounded answer in the chat UI, with its "Sources" (file · page · line) visible.
  • docs/trace.png   → a Langfuse trace for one request, showing the search tool call(s) (the agentic loop).
  Both are referenced below. Until the files exist, the images render as broken links on GitHub.
-->

![Grounded answer with per-source citations (file, page, line)](docs/answer.png)

<p align="center"><em>A grounded answer — every claim carries its source down to file, page, and line.</em></p>

![Langfuse trace showing the agentic search tool calls for one request](docs/trace.png)

<p align="center"><em>Langfuse trace of a single request: the model calls the hybrid-search tool itself (agentic loop).</em></p>

---

## What it does

- **Ingests** Markdown, plain text, and PDFs — including scanned PDFs via OCR.
- **Answers** natural-language questions (German or English) grounded in those documents.
- **Cites** every claim down to document title, page, and line.
- **Refuses honestly** — off-topic questions get *"Das steht nicht in der Wissensbasis."* instead of a hallucination.

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

- **1536-dimension embeddings (Matryoshka truncation).** `gemini-embedding-001` is truncated to 1536 dims to stay under pgvector's HNSW limit of 2000 — a full-size vector would force slow exact scans — while keeping nearly all retrieval quality. Model and length live in one source of truth (`src/lib/embeddings/config.ts`), since vectors from different models or lengths aren't comparable.
- **Retrieval ordered by raw cosine distance, ascending.** The query sorts by `ORDER BY embedding <=> query` because Postgres only uses the HNSW index for this exact shape; sorting by `1 - distance` descending silently falls back to a sequential scan.
- **Hybrid search fused with Reciprocal Rank Fusion.** Semantic (pgvector) and full-text (`tsvector`) searches run in parallel and merge via RRF (`k = 60`): semantic catches paraphrases, full-text catches exact terms, names, and numbers. RRF combines by rank, so it needs **no weight tuning** across incompatible score scales. Full-text uses the `'simple'` config (no stemming) because the corpus mixes German and English — query and index must share a config or the GIN index goes unused.
- **Agentic tool-calling, not a fixed pipeline.** Search is a *tool* the model calls itself (`tool` + `streamText`, bounded by `stopWhen: stepCountIs(4)`), so it can search once per sub-question, skip searching when it shouldn't, and never run away past the step ceiling.
- **Strict grounding.** Answers are composed *only* from retrieved passages; when nothing relevant is found the model returns the exact sentence *"Das steht nicht in der Wissensbasis."* The guarantee comes from the system prompt, not a similarity threshold — an honest refusal beats a confident hallucination.
- **Precise citations.** Page and line come from character offsets mapped against a per-page span map. PDFs are extracted **page by page** (`mergePages: false`) to preserve page boundaries, and the OCR path emits the same paged format, so citations work identically for scanned documents.
- **PDF & OCR built for serverless.** Text PDFs use [unpdf](https://github.com/unjs/unpdf) — a bundled PDF.js with **no native dependencies**, so it runs on Vercel where `pdf-parse`/Tesseract break. Scanned PDFs fall back to **Gemini multimodal OCR**, reusing the in-stack model with explicit page markers to keep page boundaries intact.
- **Model fallback across free tiers.** Generation walks an ordered list of free Gemini Flash models (`gemini-2.5-flash` → `gemini-3.5-flash` → `gemini-2.5-flash-lite`); on a 429 / `RESOURCE_EXHAUSTED` it retries with the next, pooling several free daily quotas into one. *Caveat:* the AI SDK has no built-in array fallback, so this is hand-rolled and only switches cleanly when the error surfaces at stream start (streams aren't replayable).
- **Two-sided evals.** A **retrieval eval** checks whether search returns the right passage — cheap, deterministic, no model judge. A **faithfulness eval** uses LLM-as-judge over a *separate* free provider (OpenRouter), so judging never spends the Gemini quota; its set includes off-topic questions to verify refusals.
- **Observability.** Langfuse (via OpenTelemetry) surfaces, per request, the tool calls made, which model actually answered (relevant when the fallback kicks in), latency, and token usage.
- **CI.** GitHub Actions runs the retrieval eval on every push (faithfulness excluded to preserve quota).
- **Built entirely on $0 / free tiers** — Neon, Gemini, OpenRouter, and Langfuse free plans.

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
