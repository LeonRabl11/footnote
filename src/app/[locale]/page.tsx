'use client';

import { useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { FootnoteUIMessage } from '@/lib/retrieval/chat-message';
import styles from './page.module.scss';

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ChatPage() {
  const t = useTranslations('Chat');
  const { messages, sendMessage, status, error } = useChat<FootnoteUIMessage>({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const [input, setInput] = useState('');

  const isBusy = status === 'submitted' || status === 'streaming';

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (!question) return;
    sendMessage({ text: question });
    setInput('');
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('title')}</h1>
        <p className={styles.tagline}>{t('tagline')}</p>
        <Link className={styles.uploadLink} href="/ingest">
          {t('uploadLink')}
        </Link>
      </header>

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

          return (
            <article
              key={message.id}
              className={isUser ? styles.user : styles.assistant}
            >
              <span className={styles.role}>
                {isUser ? t('you') : t('assistant')}
              </span>
              <div className={styles.text}>{text}</div>

              {sources.length > 0 && (
                <div className={styles.sources}>
                  <span className={styles.sourcesLabel}>{t('sources')}</span>
                  <ul className={styles.sourcesList}>
                    {sources.map((source) => (
                      <li key={`${source.documentId}:${source.page}:${source.line}`}>
                        {isHttpUrl(source.documentSource) ? (
                          <a
                            href={source.documentSource}
                            target="_blank"
                            rel="noreferrer"
                          >
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

      {error && (
        <p className={styles.error} role="alert">
          {t('error')}
        </p>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t('placeholder')}
          disabled={isBusy}
          className={styles.input}
          aria-label={t('placeholder')}
        />
        <button
          type="submit"
          disabled={isBusy || input.trim() === ''}
          className={styles.button}
        >
          {t('send')}
        </button>
      </form>
    </main>
  );
}
