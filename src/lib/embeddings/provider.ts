import 'server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { env } from '@/lib/env';

// Direkte Google-Provider-Instanz. Der API-Key wird EXPLIZIT aus
// GEMINI_API_KEY bezogen (env validiert ihn) – NICHT über die Default-Env-
// Variable des Pakets (GOOGLE_GENERATIVE_AI_API_KEY).
//
// Wichtig: Für Embeddings mit fester outputDimensionality MUSS dieser direkte
// Provider verwendet werden (kein Gateway-/Model-String), sonst wird
// outputDimensionality stillschweigend ignoriert.
export const google = createGoogleGenerativeAI({
  apiKey: env.GEMINI_API_KEY,
});
