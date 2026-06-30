'use client';

import { useTranslations } from 'next-intl';
import { useWorkspaceUI } from '@/components/chat/WorkspaceUIContext';
import styles from './Header.module.scss';

// Hamburger-Knopf in der Kopfzeile. Nur auf dem Handy sichtbar (CSS); öffnet bzw.
// schließt die Chat-Listen-Schublade. Reiner UI-Toggle über den Context.
export default function MenuToggle() {
  const t = useTranslations('Header');
  const { overlay, toggleSidebar } = useWorkspaceUI();
  const open = overlay === 'sidebar';

  return (
    <button
      type="button"
      onClick={toggleSidebar}
      className={styles.menuToggle}
      aria-label={open ? t('closeMenu') : t('menu')}
      aria-expanded={open}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <line x1="4" y1="7" x2="20" y2="7" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="4" y1="17" x2="20" y2="17" />
      </svg>
    </button>
  );
}
