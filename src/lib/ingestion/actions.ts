'use server';

import { z } from 'zod';
import { ingest } from './ingest';
import type { ExtractionErrorCode } from './extract';

// Hält das Limit synchron mit experimental.serverActions.bodySizeLimit in
// next.config.ts (dort etwas höher wegen multipart-Overhead). Auf Vercel ist der
// Request-Body hart auf 4,5 MB begrenzt -> Datei-Limit knapp darunter (4 MB),
// damit Nutzer eine saubere, übersetzte Meldung bekommen statt eines Plattform-413.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED_EXT = ['md', 'txt', 'pdf'] as const;

export type ValidationCode = 'no-file' | 'empty' | 'too-large' | 'bad-type';

// Typisiertes Ergebnis für useActionState. Fehler tragen einen Code (in der UI
// über next-intl übersetzt), keine fertigen Texte.
export type UploadState =
  | { kind: 'idle' }
  | { kind: 'created'; chunkCount: number; title: string }
  | { kind: 'exists'; chunkCount: number; title: string }
  | { kind: 'validation'; code: ValidationCode }
  | { kind: 'extract-error'; code: ExtractionErrorCode }
  | { kind: 'ingest-error'; message: string };

function extensionOf(fileName: string): string {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

// Die Fehlermeldung trägt jeweils den ValidationCode – wird unten ausgelesen.
const FileSchema = z
  .instanceof(File, { message: 'no-file' })
  .refine((file) => file.size > 0, { message: 'empty' })
  .refine((file) => file.size <= MAX_BYTES, { message: 'too-large' })
  .refine((file) => (ALLOWED_EXT as readonly string[]).includes(extensionOf(file.name)), {
    message: 'bad-type',
  });

export async function uploadDocument(
  _prevState: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const parsed = FileSchema.safeParse(formData.get('file'));
  if (!parsed.success) {
    return { kind: 'validation', code: parsed.error.issues[0].message as ValidationCode };
  }

  const file = parsed.data;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const ext = extensionOf(file.name);
  // Titel aus dem Dateinamen ableiten (ohne Endung), Source = voller Dateiname.
  const title = file.name.replace(/\.[^.]+$/, '') || file.name;

  // Bestehenden Orchestrator wiederverwenden – NICHT neu bauen.
  const result = await ingest({ bytes, title, source: file.name, sourceType: ext });

  switch (result.status) {
    case 'created':
      return { kind: 'created', chunkCount: result.chunkCount, title };
    case 'exists':
      return { kind: 'exists', chunkCount: result.chunkCount, title };
    case 'error':
      // Bekannte (übersetzbare) Extraktionsfehler als Code, sonst Roh-Meldung.
      return result.code
        ? { kind: 'extract-error', code: result.code }
        : { kind: 'ingest-error', message: result.message };
  }
}
