'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'dulahq.installDismissed';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari() {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua);
  const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && safari;
}

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosSteps, setShowIosSteps] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // Storage can be blocked; the banner then shows, which is harmless.
    }
    if (dismissed) return;

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setHidden(false);
    }
    function onInstalled() {
      setHidden(true);
      setDeferred(null);
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (isIosSafari()) {
      setShowIosSteps(true);
      setHidden(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // Ignored: the banner just reappears next visit.
    }
    setHidden(true);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === 'accepted') setHidden(true);
    setDeferred(null);
  }

  if (hidden || (!deferred && !showIosSteps)) return null;

  return (
    <div
      role="region"
      aria-label="Install Dulà HQ"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 60,
        maxWidth: 480,
        margin: '0 auto',
        background: 'var(--surface-raised)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
        padding: '12px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontSize: 13.5,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>Install Dulà HQ</div>
        <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
          {deferred
            ? 'Open your club and tournaments from your home screen.'
            : 'Tap Share, then “Add to Home Screen”.'}
        </div>
      </div>
      {deferred && (
        <button type="button" className="btn btn-primary" onClick={install} style={{ fontSize: 13 }}>
          Install
        </button>
      )}
      <button type="button" className="btn" onClick={dismiss} style={{ fontSize: 13 }}>
        Not now
      </button>
    </div>
  );
}
