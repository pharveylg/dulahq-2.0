'use client';

import { useRef } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';

/**
 * A soft radial glow that follows the pointer across its parent --
 * the motion-primitives "Spotlight" pattern. Purely decorative;
 * pointer-events stay off so it never intercepts clicks.
 */
export default function Spotlight({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 150, damping: 25 });
  const springY = useSpring(y, { stiffness: 150, damping: 25 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  }

  return (
    <div ref={containerRef} onMouseMove={handleMouseMove} className={className} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <motion.div
        style={{
          position: 'absolute',
          left: springX,
          top: springY,
          translateX: '-50%',
          translateY: '-50%',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
          opacity: 0.8,
        }}
      />
    </div>
  );
}
