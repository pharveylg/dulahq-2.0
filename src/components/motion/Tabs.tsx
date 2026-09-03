'use client';

import { motion } from 'motion/react';

export type Tab = { id: string; label: string; badge?: number };

/**
 * Horizontal tab strip with a sliding active-pill indicator (the
 * motion-primitives "AnimatedTabs" pattern) -- shared by every tabbed
 * page in the app so the interaction stays consistent everywhere.
 */
export default function Tabs({
  tabs,
  active,
  onChange,
  layoutId,
}: {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  /** Unique per tab strip when more than one is on screen at once. */
  layoutId?: string;
}) {
  return (
    <div
      role="tablist"
      className="scroll-clean"
      style={{
        display: 'flex',
        gap: 4,
        borderBottom: '1px solid var(--border)',
        marginBottom: 20,
        overflowX: 'auto',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              position: 'relative',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '10px 16px',
              fontFamily: 'var(--font-heading)',
              fontSize: 12.5,
              fontWeight: 600,
              letterSpacing: '.03em',
              textTransform: 'uppercase',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              whiteSpace: 'nowrap',
              transition: 'color .2s ease',
            }}
          >
            {tab.label}
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="chip" style={{ marginLeft: 6, fontSize: 9.5, padding: '1px 6px' }}>{tab.badge}</span>
            )}
            {isActive && (
              <motion.div
                layoutId={layoutId ?? 'tab-indicator'}
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                style={{
                  position: 'absolute',
                  left: 8,
                  right: 8,
                  bottom: -1,
                  height: 2,
                  borderRadius: 2,
                  background: 'var(--accent-gradient)',
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
