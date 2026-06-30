import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import styles from './Header.module.scss';

// Schlanke, ruhige Kopfzeile über dem Drei-Bereiche-Layout. Reine Optik – keine
// Funktion. Server-Komponente (kein Client-Bundle nötig).
export default async function Header() {
  const t = await getTranslations('Header');

  return (
    <header className={styles.header}>
      {/* Klick aufs Logo -> Startseite (leerer Workspace) unter [locale]. */}
      <Link href="/" className={styles.logo} aria-label={t('home')}>
        {/* Signatur-Marke (rein per SVG): ein paar „Textzeilen“ mit einer
            hochgestellten Fußnoten-Referenz – thematisch zu „Footnote“. Die
            Zeilen in Primärtext (currentColor), der Referenz-Punkt im Akzent. */}
        <svg
          className={styles.mark}
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <g
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="4" y1="9.5" x2="13" y2="9.5" />
            <line x1="4" y1="14.5" x2="15" y2="14.5" />
            <line x1="4" y1="19.5" x2="10" y2="19.5" />
          </g>
          <circle className={styles.markDot} cx="18.5" cy="6" r="2.6" />
        </svg>
        <span className={styles.wordmark}>Footnote</span>
      </Link>
    </header>
  );
}
