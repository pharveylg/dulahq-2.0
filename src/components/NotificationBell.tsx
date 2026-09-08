'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRow,
} from '@/lib/notifications-actions';

function timeAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export default function NotificationBell({ initial }: { initial: NotificationRow[] }) {
  const [notifications, setNotifications] = useState(initial);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      const fresh = await getMyNotifications();
      setNotifications(fresh);
    }
  }

  async function handleSelect(n: NotificationRow) {
    if (!n.read_at) {
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
      await markNotificationRead(n.id);
    }
    setOpen(false);
    if (n.link_path) router.push(n.link_path);
  }

  async function handleMarkAllRead() {
    setNotifications((prev) => prev.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    await markAllNotificationsRead();
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={toggleOpen}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        style={{
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 34,
          height: 34,
          borderRadius: '50%',
          border: '1px solid var(--border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          color: 'var(--text-muted)',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: '0 3px',
              borderRadius: 999,
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="card"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: 420,
            overflowY: 'auto',
            padding: 0,
            zIndex: 30,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 600, fontSize: 13.5 }}>Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer', padding: 0 }}
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', padding: 20, margin: 0, textAlign: 'center' }}>
              Nothing here yet.
            </p>
          )}

          {notifications.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => handleSelect(n)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                gap: 3,
                width: '100%',
                textAlign: 'left',
                padding: '12px 16px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: n.read_at ? 'var(--surface)' : 'var(--surface-raised)',
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: n.read_at ? 500 : 700, color: 'var(--text)' }}>
                {n.payload?.title ?? n.template}
              </span>
              {n.payload?.body && (
                <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{n.payload.body}</span>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{timeAgo(n.created_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
