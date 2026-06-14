/**
 * CodexBoot — minimal logo boot animation
 * Replaces HardcoreBootSequence with a simple 2s fade.
 */
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const DURATION_MS = 2000;

export function CodexBoot({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'fadeIn' | 'hold' | 'fadeOut'>('fadeIn');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('fadeOut'), 1400);
    const t3 = setTimeout(onComplete, DURATION_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0a0a]"
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="flex flex-col items-center gap-4"
          animate={{
            opacity: phase === 'fadeIn' ? [0, 1] : phase === 'fadeOut' ? [1, 0] : 1,
            scale: phase === 'fadeIn' ? [0.96, 1] : 1,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Logo mark — geometric G */}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <motion.circle
              cx="24" cy="24" r="22"
              stroke="#22c55e" strokeWidth="2"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.8, delay: 0.1 }}
            />
            <motion.path
              d="M28 14H16v20h14v-8h-8"
              stroke="#22c55e" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
            />
          </svg>

          <motion.span
            className="text-sm font-mono tracking-[0.3em] text-green-500/60 uppercase"
            animate={{ opacity: [0, 0.7] }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            Gaea
          </motion.span>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
