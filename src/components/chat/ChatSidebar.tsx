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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  // CHAT LÖSCHEN (nicht zu verwechseln mit "Dokument aus Bibliothek löschen"):
  // entfernt Chat + Nachrichten + Dokument-Zuordnungen; die Dokumente bleiben.
  async function handleDeleteChat(id: string) {
    if (!window.confirm(t('confirmDeleteChat'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/chats/${id}`, { method: 'DELETE' });
      if (!res.ok) return;
      const remaining = chats.filter((chat) => chat.id !== id);
      setChats(remaining);
      emitChatsChanged();
      // War es der offene Chat -> zu einem anderen oder in den Startzustand.
      if (id === activeChatId) {
        router.push(remaining.length > 0 ? `/c/${remaining[0].id}` : '/');
      }
    } finally {
      setDeletingId(null);
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
              <li key={chat.id} className={styles.row}>
                <Link
                  href={`/c/${chat.id}`}
                  className={isActive ? styles.itemActive : styles.item}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {chat.title}
                </Link>
                <button
                  type="button"
                  className={styles.deleteChat}
                  aria-label={t('deleteChat')}
                  title={t('deleteChat')}
                  disabled={deletingId === chat.id}
                  onClick={() => handleDeleteChat(chat.id)}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6M10 11v6M14 11v6" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
