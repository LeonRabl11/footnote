import type { ReactNode } from 'react';

// Vercel: Route-Segment-Config für die Ingestion. Das Einlesen kann den
// OCR-Fallback (Gemini-Aufruf bei gescannten PDFs) auslösen und damit länger als
// die kurze Default-Funktionslaufzeit dauern. maxDuration gilt laut Next.js-Doc
// für die Server Actions dieses Segments (uploadDocument). Es steht hier im
// Layout, weil ingest/page.tsx 'use client' ist und Route-Segment-Config nicht
// aus einer Client-Komponente exportiert werden darf. 60 s liegt im Hobby-Limit;
// höhere Werte bräuchten Fluid compute (Dashboard-Einstellung, kein Code).
export const maxDuration = 60;

export default function IngestLayout({ children }: { children: ReactNode }) {
  return children;
}
