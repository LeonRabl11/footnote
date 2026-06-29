// Next.js Instrumentation-Hook (EINE Datei). Next ruft beim Server-Start
// `register()` auf – einmal pro Runtime. Wir registrieren hier den Langfuse-
// Span-Processor über OpenTelemetry, damit alle AI-SDK-Generierungen (inkl.
// der agentic Tool-Aufrufe, Latenz und Tokens) als Traces nach Langfuse gehen.
//
// AI-SDK v6 (stable): Telemetrie kommt über `experimental_telemetry` an den
// streamText-Aufrufen (siehe answer.ts) + diesem Span-Processor. KEINE v7-beta-
// Pakete. Verwendete Pakete: @langfuse/otel (LangfuseSpanProcessor),
// @opentelemetry/sdk-trace-node (NodeTracerProvider).
//
// Zugangsdaten ausschließlich aus Umgebungsvariablen (vom SDK gelesen):
//   LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY, LANGFUSE_BASE_URL
// Der installierte @langfuse/otel-Client liest die Host-URL aus LANGFUSE_BASE_URL
// (mit LANGFUSE_BASEURL als Legacy-Fallback) – wir dokumentieren den kanonischen
// Namen LANGFUSE_BASE_URL in .env.example.
//
// Node-Runtime: Das OTel-Node-SDK läuft NICHT in der Edge-Runtime (das Locale-
// Routing in src/proxy.ts ist Edge). Daher Setup nur für NEXT_RUNTIME === 'nodejs'
// und die Node-Pakete erst dort dynamisch importieren – so wird in der Edge-
// Runtime nichts Node-spezifisches geladen. Der Chat-Endpunkt ist bereits nodejs.

import type { LangfuseSpanProcessor } from '@langfuse/otel';

// Mutable Export: wird in register() (nur Node-Runtime) gesetzt. Der Route
// Handler importiert diese Live-Binding-Referenz, um nach der Antwort zu flushen
// (siehe src/app/api/chat/route.ts). Bis register() lief: undefined → optionales
// Flushen per `?.` schadet nicht.
export let langfuseSpanProcessor: LangfuseSpanProcessor | undefined;

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Erst hier (Node-Runtime) laden – nicht in der Edge-Runtime.
  const { LangfuseSpanProcessor } = await import('@langfuse/otel');
  const { NodeTracerProvider } = await import('@opentelemetry/sdk-trace-node');

  langfuseSpanProcessor = new LangfuseSpanProcessor();

  // Globalen Tracer registrieren, damit das AI SDK seine Spans hier ablegt.
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });
  tracerProvider.register();
}
