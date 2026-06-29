'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadDocument, type UploadState } from '@/lib/ingestion/actions';
import styles from './AddDocumentsDialog.module.scss';

type LibraryDocument = {
  id: string;
  title: string;
  sourceType: string;
  createdAt: string;
};

type Props = {
  chatId: string;
  open: boolean;
  // documentIds, die bereits im Chat sind -> aus der Bibliotheksauswahl ausblenden.
  currentDocumentIds: string[];
  onClose: () => void;
  // Nach jeder Änderung (zuordnen ODER hochladen) -> Workspace lädt Doku-Liste neu.
  onChanged: () => void;
};

const UPLOAD_INITIAL: UploadState = { kind: 'idle' };

export default function AddDocumentsDialog({
  chatId,
  open,
  currentDocumentIds,
  onClose,
  onChanged,
}: Props) {
  const t = useTranslations('Documents');
  const tIngest = useTranslations('Ingest');
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [library, setLibrary] = useState<LibraryDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);

  const [uploadState, uploadAction, uploadPending] = useActionState(
    uploadDocument,
    UPLOAD_INITIAL,
  );

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/documents');
      if (res.ok) setLibrary((await res.json()) as LibraryDocument[]);
    } finally {
      setLoading(false);
    }
  }, []);

  // <dialog> imperativ öffnen/schließen, je nach `open`-Prop.
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      void loadLibrary();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, loadLibrary]);

  // Nach erfolgreichem Upload: Doku zugeordnet (Action erledigt das) -> Workspace
  // benachrichtigen und Bibliotheksliste auffrischen.
  useEffect(() => {
    if (uploadState.kind === 'created' || uploadState.kind === 'exists') {
      onChanged();
      void loadLibrary();
    }
  }, [uploadState, onChanged, loadLibrary]);

  async function addFromLibrary(documentId: string) {
    setAddingId(documentId);
    try {
      const res = await fetch(`/api/chats/${chatId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });
      if (res.ok) onChanged();
    } finally {
      setAddingId(null);
    }
  }

  // Nur Bibliotheks-Dokumente anbieten, die noch nicht im Chat sind.
  const available = library.filter((doc) => !currentDocumentIds.includes(doc.id));

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h2 className={styles.title}>{t('dialogTitle')}</h2>
          <button type="button" onClick={onClose} className={styles.close}>
            {t('close')}
          </button>
        </header>

        {/* (a) Aus der Bibliothek wählen */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('fromLibrary')}</h3>
          {loading ? (
            <p className={styles.muted}>{t('loading')}</p>
          ) : available.length === 0 ? (
            <p className={styles.muted}>{t('noLibraryDocs')}</p>
          ) : (
            <ul className={styles.libraryList}>
              {available.map((doc) => (
                <li key={doc.id} className={styles.libraryItem}>
                  <span className={styles.docTitle}>
                    {doc.title}
                    <span className={styles.docType}> · {doc.sourceType}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => addFromLibrary(doc.id)}
                    disabled={addingId === doc.id}
                    className={styles.addButton}
                  >
                    {addingId === doc.id ? t('adding') : t('add')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* (b) Neues Dokument hochladen (Server Action MIT chatId) */}
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t('uploadNew')}</h3>
          <form action={uploadAction} className={styles.uploadForm}>
            <input type="hidden" name="chatId" value={chatId} />
            <input
              type="file"
              name="file"
              accept=".md,.txt,.pdf"
              required
              disabled={uploadPending}
              className={styles.fileInput}
              aria-label={tIngest('fileLabel')}
            />
            <button type="submit" disabled={uploadPending} className={styles.addButton}>
              {uploadPending ? tIngest('submitting') : tIngest('submit')}
            </button>
          </form>

          {/* Upload-Feedback (übersetzte Codes wie auf der Ingest-Seite). */}
          {uploadState.kind === 'created' && (
            <p className={styles.success} role="status">
              {tIngest('created', {
                count: uploadState.chunkCount,
                title: uploadState.title,
              })}
            </p>
          )}
          {uploadState.kind === 'exists' && (
            <p className={styles.muted} role="status">
              {tIngest('exists', {
                count: uploadState.chunkCount,
                title: uploadState.title,
              })}
            </p>
          )}
          {uploadState.kind === 'validation' && (
            <p className={styles.error} role="alert">
              {tIngest(`validation.${uploadState.code}`)}
            </p>
          )}
          {uploadState.kind === 'extract-error' && (
            <p className={styles.error} role="alert">
              {tIngest(`extractError.${uploadState.code}`)}
            </p>
          )}
          {uploadState.kind === 'ingest-error' && (
            <p className={styles.error} role="alert">
              {tIngest('ingestError', { message: uploadState.message })}
            </p>
          )}
        </section>
      </div>
    </dialog>
  );
}
