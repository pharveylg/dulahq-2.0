'use client';

import { motion } from 'motion/react';

export type VerticalTab = { id: string; title: string; meta?: string };

/**
 * A vertical list of selectable rows with a sliding accent bar on the
 * active one -- used for the coach roster's "each player is its own tab"
 * layout (name list on the left, detail panel on the right).
 */
export default function VerticalTabList({
  items,
  active,
  onChange,
}: {
  items: VerticalTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-orientation="vertical">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            style={{
              position: 'relative',
              display: 'block',
              width: '100%',
              textAlign: 'left',
              background: isActive ? 'var(--accent-soft)' : 'transparent',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              padding: '10px 12px 10px 16px',
              marginBottom: 2,
              cursor: 'pointer',
              transition: 'background .2s ease',
            }}
          >
            {isActive && (
              <motion.div
                layoutId="vertical-tab-indicator"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 4,
                  bottom: 4,
                  width: 3,
                  borderRadius: 2,
                  background: 'var(--accent-gradient)',
                }}
              />
            )}
            <div style={{ fontSize: 13.5, fontWeight: 600, color: isActive ? 'var(--accent)' : 'var(--text)' }}>{item.title}</div>
            {item.meta && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>{item.meta}</div>}
          </button>
        );
      })}
    </div>
  );
}
