import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Next.js 16: Diese Datei heißt `proxy.ts` (früher `middleware.ts`).
// Leitet Requests auf die passende Locale um (z. B. "/" -> "/de").
export default createMiddleware(routing);

export const config = {
  // Alle Pfade außer API-Routen, Next-Internals und Dateien mit Endung.
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
