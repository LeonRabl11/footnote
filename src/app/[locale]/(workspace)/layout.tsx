import type { ReactNode } from 'react';
import { setRequestLocale } from 'next-intl/server';
import Header from '@/components/layout/Header';
import ChatSidebar from '@/components/chat/ChatSidebar';
import styles from './layout.module.scss';

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

// Arbeitsflächen-Shell: durchgehende Kopfzeile oben, darunter Seitenleiste +
// Inhalt. Route-Gruppe (workspace) -> kein eigenes URL-Segment. /ingest liegt
// außerhalb und bekommt diese Shell NICHT.
export default async function WorkspaceLayout({ children, params }: Props) {
  // Locale für statisches Rendering vorgeben, damit getTranslations() im Header
  // die Startseite nicht in dynamisches Rendering zwingt.
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.shell}>
        <ChatSidebar />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
