'use client';

import { motion } from 'motion/react';

/**
 * Fade + rise on mount, staggered by `index` -- the motion-primitives
 * "InView" pattern, simplified to a mount-triggered variant since every
 * call site here is already gated behind auth/data-loaded server
 * rendering (nothing above the fold needs a scroll trigger).
 */
export default function Reveal({
  children,
  index = 0,
  className,
  style,
}: {
  children: React.ReactNode;
  index?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
      className={className}
      style={style}
    >
      {children}
    </motion.div>
  );
}
