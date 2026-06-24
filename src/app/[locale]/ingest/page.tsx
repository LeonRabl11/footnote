'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadDocument, type UploadState } from '@/lib/ingestion/actions';
import styles from './page.module.scss';

const INITIAL: UploadState = { kind: 'idle' };

export default function IngestPage() {
  const t = useTranslations('Ingest');
  const [state, formAction, isPending] = useActionState(uploadDocument, INITIAL);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t('title')}</h1>
      <p className={styles.description}>{t('description')}</p>

      <form action={formAction} className={styles.form}>
        <label className={styles.label} htmlFor="file">
          {t('fileLabel')}
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".md,.txt,.pdf"
          required
          disabled={isPending}
          className={styles.input}
        />
        <button type="submit" disabled={isPending} className={styles.button}>
          {isPending ? t('submitting') : t('submit')}
        </button>
      </form>

      {state.kind === 'created' && (
        <p className={styles.success} role="status">
          {t('created', { count: state.chunkCount, title: state.title })}
        </p>
      )}
      {state.kind === 'exists' && (
        <p className={styles.info} role="status">
          {t('exists', { count: state.chunkCount, title: state.title })}
        </p>
      )}
      {state.kind === 'validation' && (
        <p className={styles.error} role="alert">
          {t(`validation.${state.code}`)}
        </p>
      )}
      {state.kind === 'extract-error' && (
        <p className={styles.error} role="alert">
          {t(`extractError.${state.code}`)}
        </p>
      )}
      {state.kind === 'ingest-error' && (
        <p className={styles.error} role="alert">
          {t('ingestError', { message: state.message })}
        </p>
      )}
    </main>
  );
}
