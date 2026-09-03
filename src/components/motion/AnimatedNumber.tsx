'use client';

import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useInView } from 'motion/react';

/**
 * Counts up from 0 to `value` with a spring, triggered once it enters
 * view -- the motion-primitives "AnimatedNumber"/"SlidingNumber" pattern,
 * used on the club dashboard's stat tiles.
 */
export default function AnimatedNumber({
  value,
  suffix = '',
  decimals = 0,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 90, damping: 20 });

  useEffect(() => {
    if (inView) motionValue.set(value);
  }, [inView, value, motionValue]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = `${latest.toFixed(decimals)}${suffix}`;
    });
  }, [spring, decimals, suffix]);

  return <motion.span ref={ref}>0{suffix}</motion.span>;
}
