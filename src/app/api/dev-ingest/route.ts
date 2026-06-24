// ============================================================================
// TEMPORÄRER Test-Endpunkt – wird im nächsten Schritt wieder ENTFERNT.
//
// Liest sample-docs/hello.md, schickt es durch die Ingestion-Engine und gibt
// das Ergebnis als JSON zurück. Dient nur zum Verifizieren gegen die echte DB
// + Gemini-API. Keine Auth, keine Validierung von Eingaben – bitte nicht in
// Produktion lassen.
//
// Liegt unter /api/dev-ingest und wird vom next-intl-Locale-Proxy NICHT
// abgefangen (der matcher in src/proxy.ts schließt /api aus).
// ============================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { ingest } from '@/lib/ingestion/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'sample-docs', 'hello.md');
    const bytes = await readFile(filePath);

    const result = await ingest({
      bytes,
      title: 'Footnote – Beispieldokument',
      source: 'sample-docs/hello.md',
      sourceType: 'md',
    });

    const httpStatus = result.status === 'error' ? 422 : 200;
    return NextResponse.json(result, { status: httpStatus });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unbekannter Fehler.',
      },
      { status: 500 },
    );
  }
}
