'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useTranslations } from 'next-intl';
import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';
import { emitChatsChanged } from '@/lib/chat/events';
import AddDocumentsDialog from './AddDocumentsDialog';
import styles from './ChatWorkspace.module.scss';

export type ChatDocument = { id: string; title: string; sourceType: string };

type Props = {
  chatId: string;
  initialMessages: FootnoteUIMessage[];
  initialDocuments: ChatDocument[];
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Mitte + rechtes Kontext-Panel eines Chats. Wird vom Eltern-RSC mit key={chatId}
// gemountet -> jeder Chat hat eine eigene, frische useChat-Instanz.
export default function ChatWorkspace({
  chatId,
  initialMessages,
  initialDocuments,
}: Props) {
  const t = useTranslations('Chat');
  const tw = useTranslations('Workspace');
  const td = useTranslations('Documents');

  const { messages, sendMessage, status, error } = useChat<FootnoteUIMessage>({
    messages: initialMessages, // gespeicherten Verlauf laden
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });

  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState<ChatDocument[]>(initialDocuments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isBusy = status === 'submitted' || status === 'streaming';
  const hasDocs = documents.length > 0;

  // Doku-Liste des Chats neu laden (nach Hinzufügen/Hochladen/Entfernen). Nutzt
  // GET /api/chats/[id] und übernimmt NUR die Dokumente (Nachrichten verwaltet useChat).
  const refreshDocuments = useCallback(async () => {
    const res = await fetch(`/api/chats/${chatId}`);
    if (res.ok) {
      const data = (await res.json()) as { documents: ChatDocument[] };
      setDocuments(data.documents);
    }
  }, [chatId]);

  // Sidebar-Titel kann sich nach dem ersten Beitrag geändert haben -> nach jedem
  // abgeschlossenen Turn die Chat-Liste signalisieren.
  const prevStatus = useRef(status);
  useEffect(() => {
    if (prevStatus.current !== 'ready' && status === 'ready') {
      emitChatsChanged();
    }
    prevStatus.current = status;
  }, [status]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question || !hasDocs) return;
    // chatId pro Anfrage über das ZWEITE Argument (nicht hook-level body -> stale).
    sendMessage({ text: question }, { body: { chatId } });
    setInput('');
  }

  async function handleRemoveDocument(documentId: string) {
    setRemovingId(documentId);
    try {
      const res = await fetch(`/api/chats/${chatId}/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (res.ok) await refreshDocuments();
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className={hasDocs ? styles.layoutWithPanel : styles.layout}>
      {/* MITTE */}
      <section className={styles.chatColumn}>
        {hasDocs ? (
          <div className={styles.messages}>
            {messages.length === 0 && <p className={styles.empty}>{t('empty')}</p>}

            {messages.map((message) => {
              const text = message.parts
                .filter((part) => part.type === 'text')
                .map((part) => part.text)
                .join('');
              const sources =
                message.role === 'assistant' ? message.metadata?.sources ?? [] : [];
              const isUser = message.role === 'user';
              const isSearching = message.parts.some(
                (part) =>
                  part.type === 'tool-searchKnowledgeBase' &&
                  (part.state === 'input-streaming' || part.state === 'input-available'),
              );

              return (
                <article
                  key={message.id}
                  className={isUser ? styles.user : styles.assistant}
                >
                  <span className={styles.role}>{isUser ? t('you') : t('assistant')}</span>
                  <div className={styles.text}>{text}</div>

                  {isSearching && (
                    <p className={styles.pending} role="status">
                      {t('searching')}
                    </p>
                  )}

                  {sources.length > 0 && (
                    <div className={styles.sources}>
                      <span className={styles.sourcesLabel}>{t('sources')}</span>
                      <ul className={styles.sourcesList}>
                        {sources.map((source) => (
                          <li key={`${source.documentId}:${source.page}:${source.line}`}>
                            {isHttpUrl(source.documentSource) ? (
                              <a href={source.documentSource} target="_blank" rel="noreferrer">
                                {source.documentTitle}
                              </a>
                            ) : (
                              source.documentTitle
                            )}
                            {source.line != null && (
                              <span className={styles.position}>
                                {' '}
                                {source.sourceType === 'pdf' && source.page != null
                                  ? t('sourcePdf', { page: source.page, line: source.line })
                                  : t('sourceText', { line: source.line })}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              );
            })}

            {status === 'submitted' && (
              <p className={styles.pending} role="status">
                {t('thinking')}
              </p>
            )}
          </div>
        ) : (
          // Leer-Zustand: noch keine Dokumente -> klare Aufforderung.
          <div className={styles.emptyState}>
            <h2 className={styles.emptyStateTitle}>{tw('emptyTitle')}</h2>
            <p className={styles.emptyStateHint}>{tw('emptyHint')}</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className={styles.primaryButton}
            >
              {tw('addDocuments')}
            </button>
          </div>
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error.message?.includes('quota-exhausted') ? t('quotaExhausted') : t('error')}
          </p>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t('placeholder')}
            // Ohne Dokumente kann nichts beantwortet werden -> Eingabe deaktiviert.
            disabled={!hasDocs || isBusy}
            className={styles.input}
            aria-label={t('placeholder')}
          />
          <button
            type="submit"
            disabled={!hasDocs || isBusy || input.trim() === ''}
            className={styles.button}
          >
            {t('send')}
          </button>
        </form>
      </section>

      {/* RECHTS: Kontext-Panel – nur wenn der Chat Dokumente hat. */}
      {hasDocs && (
        <aside className={styles.contextColumn} aria-label={td('panelTitle')}>
          <header className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{td('panelTitle')}</h2>
            <p className={styles.panelSubtitle}>{td('panelSubtitle')}</p>
          </header>

          <ul className={styles.docList}>
            {documents.map((doc) => (
              <li key={doc.id} className={styles.docItem}>
                <span className={styles.docTitle}>
                  {doc.title}
                  <span className={styles.docType}> · {doc.sourceType}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveDocument(doc.id)}
                  disabled={removingId === doc.id}
                  className={styles.removeButton}
                >
                  {removingId === doc.id ? td('removing') : td('remove')}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className={styles.secondaryButton}
          >
            {tw('addDocuments')}
          </button>
        </aside>
      )}

      <AddDocumentsDialog
        chatId={chatId}
        open={dialogOpen}
        currentDocumentIds={documents.map((doc) => doc.id)}
        onClose={() => setDialogOpen(false)}
        onChanged={refreshDocuments}
      />
    </div>
  );
}
