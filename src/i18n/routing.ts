import { defineRouting } from 'next-intl/routing';

// Zentrale Definition der unterstützten Sprachen. Neue Sprache hier ergänzen
// und eine passende Datei unter messages/<locale>.json anlegen.
export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
});
