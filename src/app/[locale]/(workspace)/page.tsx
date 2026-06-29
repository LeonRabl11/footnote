import { getTranslations, setRequestLocale } from 'next-intl/server';
import styles from './page.module.scss';

type Props = { params: Promise<{ locale: string }> };

// /[locale] – kein Chat ausgewählt. Die Seitenleiste (Layout) bietet "Neuer Chat".
export default async function WorkspaceHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Workspace');

  return (
    <div className={styles.placeholder}>
      <p>{t('noChatSelected')}</p>
    </div>
  );
}
