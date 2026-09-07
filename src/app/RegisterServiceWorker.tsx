'use client';

import { useEffect } from 'react';

export default function RegisterServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Installability is a nice-to-have, not a hard requirement -- a
        // failed registration (unsupported browser, blocked by an
        // extension, etc.) shouldn't be user-visible.
      });
    }
  }, []);

  return null;
}
