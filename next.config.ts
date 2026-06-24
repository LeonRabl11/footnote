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
};

export default withNextIntl(nextConfig);
