import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-bewusste Ersatz-APIs für die Next.js-Navigation. Im Code immer
// diese statt next/link bzw. next/navigation verwenden.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
