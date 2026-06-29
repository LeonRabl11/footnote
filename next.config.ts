import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Points the plugin at the request-scoped i18n config.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // SCSS Modules funktionieren out of the box, sobald `sass` installiert ist.
  // `_tokens.scss` wird in jedem Modul via `@use '@/styles/tokens' as *` geladen,
  // deshalb hier loadPaths setzen, damit der `@/`-Alias auch in SCSS greift.
  sassOptions: {
    loadPaths: ['./src'],
  },
  experimental: {
    serverActions: {
      // Vercel begrenzt den Request-Body hart auf 4,5 MB. Datei-Limit ist 4 MB
      // (siehe actions.ts); hier knapp darüber, damit der multipart-Overhead
      // (Boundaries, Part-Header) einer 4-MB-Datei noch bis zur Zod-Validierung
      // durchkommt und der Nutzer die saubere "max. 4 MB"-Meldung sieht.
      bodySizeLimit: '4.5mb',
    },
  },
  // unpdf bringt einen gebündelten PDF.js-Build mit; als externes Server-Paket
  // belassen, damit der Bundler ihn nicht umschreibt. Die Langfuse-/OTel-Pakete
  // (Tracing in src/instrumentation.ts) ebenfalls extern halten – das Node-OTel-
  // SDK soll nicht vom Bundler umgeschrieben werden.
  serverExternalPackages: [
    'unpdf',
    '@langfuse/otel',
    '@langfuse/tracing',
    '@opentelemetry/sdk-trace-node',
  ],
};

export default withNextIntl(nextConfig);
