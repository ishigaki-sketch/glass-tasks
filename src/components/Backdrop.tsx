import { motion } from 'motion/react';
import type { Status } from '../api';

/** ガラスの屈折を見せるための淡い色の層。表示中のステータスに合わせて色の重心が移る */
const LAYOUT: Record<Status, { a: [string, string]; b: [string, string]; c: [string, string] }> = {
  todo: { a: ['-10%', '-8%'], b: ['62%', '18%'], c: ['10%', '70%'] },
  doing: { a: ['55%', '-12%'], b: ['-14%', '30%'], c: ['50%', '68%'] },
  done: { a: ['30%', '62%'], b: ['60%', '-10%'], c: ['-16%', '12%'] },
};

export function Backdrop({ tone }: { tone: Status }) {
  const l = LAYOUT[tone];
  const t = { duration: 1.6, ease: [0.22, 1, 0.36, 1] as const };
  return (
    <div className="backdrop" aria-hidden>
      <motion.div className="blob blob-todo" animate={{ left: l.a[0], top: l.a[1], scale: tone === 'todo' ? 1.25 : 0.9 }} transition={t} />
      <motion.div className="blob blob-doing" animate={{ left: l.b[0], top: l.b[1], scale: tone === 'doing' ? 1.25 : 0.9 }} transition={t} />
      <motion.div className="blob blob-done" animate={{ left: l.c[0], top: l.c[1], scale: tone === 'done' ? 1.25 : 0.9 }} transition={t} />
      <div className="grain" />
    </div>
  );
}
