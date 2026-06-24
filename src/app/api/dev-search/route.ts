// ============================================================================
// TEMPORÄRER Test-Endpunkt – wird im nächsten Schritt (Chat-UI) ENTFERNT.
//
// Liegt unter /api/dev-search und wird vom next-intl-Locale-Proxy NICHT
// abgefangen (der matcher in src/proxy.ts schließt /api aus).
//
//   GET /api/dev-search?q=<frage>                 -> streamt die LLM-Antwort
//   GET /api/dev-search?q=<frage>&mode=retrieval  -> nur Retrieval-Treffer (JSON),
//                                                    OHNE LLM (schont Gemini-Quota)
// ============================================================================

import { NextResponse } from 'next/server';
import { retrieve } from '@/lib/retrieval/retrieve';
import { answer } from '@/lib/retrieval/answer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const mode = searchParams.get('mode');

  if (!query) {
    return NextResponse.json(
      { error: 'Query-Parameter ?q=<frage> fehlt.' },
      { status: 400 },
    );
  }

  // Retrieval-Modus: nur die Treffer, kein LLM-Aufruf.
  if (mode === 'retrieval') {
    const hits = await retrieve(query);
    return NextResponse.json(
      hits.map((hit) => ({
        documentTitle: hit.documentTitle,
        chunkIndex: hit.chunkIndex,
        similarity: Number(hit.similarity.toFixed(4)),
        snippet: hit.content.slice(0, 200),
      })),
    );
  }

  // Antwort-Modus: Quellen ins Terminal loggen, Antwort als Text-Stream zurück.
  const { result, hits } = await answer(query);
  console.log(
    '[dev-search] Quellen:',
    hits.map((h) => `${h.documentTitle} (sim=${h.similarity.toFixed(3)})`),
  );

  return result.toTextStreamResponse();
}
