import { useTranslations } from 'next-intl';
import styles from './page.module.scss';

// Platzhalter-Startseite. Demonstriert die zwei Kern-Konventionen:
// 1. Alle Texte über next-intl (useTranslations), kein hartkodierter Text.
// 2. Alle Werte über Tokens (var(--…)) im SCSS-Modul, keine festen Werte.
export default function HomePage() {
  const t = useTranslations('Home');

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={styles.tagline}>{t('tagline')}</p>
      <p className={styles.placeholder}>{t('placeholder')}</p>
    </main>
  );
}
