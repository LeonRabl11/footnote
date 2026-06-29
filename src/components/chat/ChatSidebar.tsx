'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { CHATS_CHANGED_EVENT, emitChatsChanged } from '@/lib/chat/events';
import styles from './ChatSidebar.module.scss';

type ChatListItem = { id: string; title: string; updatedAt: string };

// Linke Seitenleiste: Liste aller Chats (neueste zuerst) + "Neuer Chat".
// Gemeinsam für alle Chats (liegt im Workspace-Layout); der aktive Chat kommt
// aus der URL (useParams), nicht aus eigenem State.
export default function ChatSidebar() {
  const t = useTranslations('Workspace');
  const router = useRouter();
  const params = useParams<{ chatId?: string }>();
  const activeChatId = params?.chatId;

  const [chats, setChats] = useState<ChatListItem[]>([]);
  const [creating, setCreating] = useState(false);

  const loadChats = useCallback(async () => {
    const res = await fetch('/api/chats');
    if (res.ok) setChats((await res.json()) as ChatListItem[]);
  }, []);

  // Initial laden + bei Änderungen (neuer Chat / Titel nach erster Nachricht).
  useEffect(() => {
    void loadChats();
    window.addEventListener(CHATS_CHANGED_EVENT, loadChats);
    return () => window.removeEventListener(CHATS_CHANGED_EVENT, loadChats);
  }, [loadChats]);

  async function handleNewChat() {
    setCreating(true);
    try {
      const res = await fetch('/api/chats', { method: 'POST' });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id: string };
      emitChatsChanged(); // Liste aktualisieren
      router.push(`/c/${id}`); // direkt in den neuen Chat wechseln
    } finally {
      setCreating(false);
    }
  }

  return (
    <nav className={styles.sidebar} aria-label={t('chatsHeading')}>
      <button
        type="button"
        onClick={handleNewChat}
        disabled={creating}
        className={styles.newChat}
      >
        {t('newChat')}
      </button>

      {chats.length === 0 ? (
        <p className={styles.empty}>{t('noChats')}</p>
      ) : (
        <ul className={styles.list}>
          {chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <li key={chat.id}>
                <Link
                  href={`/c/${chat.id}`}
                  className={isActive ? styles.itemActive : styles.item}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {chat.title}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
