'use client';

import { useEffect, useState } from 'react';
import { savePushSubscription } from '@/lib/push-actions';

/** Base64url (the VAPID key format) -> Uint8Array, what pushManager.subscribe expects. */
function urlBase64ToUint8Array(base64Url: string) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Status = 'idle' | 'checking' | 'subscribing' | 'subscribed' | 'unsupported' | 'denied' | 'error';

export default function NotificationSubscribe() {
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      setStatus('unsupported');
      return;
    }
    if (Notification.permission === 'denied') {
      setStatus('denied');
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? 'subscribed' : 'idle'))
      .catch(() => setStatus('idle'));
  }, []);

  async function subscribe() {
    setStatus('subscribing');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'idle');
        return;
      }
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) throw new Error('missing VAPID key');

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const keys = sub.toJSON().keys;
      if (!keys?.p256dh || !keys?.auth) throw new Error('subscription missing keys');

      const result = await savePushSubscription(sub.endpoint, keys.p256dh, keys.auth);
      if (result.error) throw new Error(result.error);
      setStatus('subscribed');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'checking' || status === 'unsupported' || status === 'subscribed') return null;

  return (
    <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
      <div>
        <div className="list-row-title">Turn on notifications</div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {status === 'denied'
            ? 'Notifications are blocked for this site. Enable them in your browser settings to receive alerts here.'
            : 'Get alerted here about fees, documents, and updates without checking email.'}
        </p>
        {status === 'error' && (
          <p style={{ fontSize: 12.5, color: 'var(--color-danger, #b3261e)', margin: '4px 0 0' }}>
            Something went wrong subscribing. Try again.
          </p>
        )}
      </div>
      {status !== 'denied' && (
        <button className="btn btn-primary" style={{ fontSize: 12, flexShrink: 0 }} disabled={status === 'subscribing'} onClick={subscribe}>
          {status === 'subscribing' ? 'Enabling…' : 'Enable'}
        </button>
      )}
    </div>
  );
}
