import type { ReactNode } from 'react';
import ChatSidebar from '@/components/chat/ChatSidebar';
import styles from './layout.module.scss';

// Arbeitsflächen-Shell: linke Seitenleiste (gemeinsam für alle Chats) + Inhalt.
// Route-Gruppe (workspace) -> kein eigenes URL-Segment. /ingest liegt außerhalb
// und bekommt diese Shell NICHT.
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <ChatSidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
