import 'server-only';
import { z } from 'zod';

// Typisiertes, validiertes Env-Modul. Wird beim ersten Import (serverseitig)
// ausgeführt und bricht mit klarer Meldung ab, wenn etwas fehlt.
// Secrets kommen AUSSCHLIESSLICH aus Umgebungsvariablen – siehe .env.example.
const EnvSchema = z.object({
  DATABASE_URL: z.url('DATABASE_URL muss eine gültige Postgres-Connection-URL sein'),
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY darf nicht leer sein'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    '\n❌ Ungültige Umgebungsvariablen:\n' + z.prettifyError(parsed.error) + '\n',
  );
  throw new Error('Ungültige Umgebungsvariablen – siehe .env.example');
}

export const env = parsed.data;
