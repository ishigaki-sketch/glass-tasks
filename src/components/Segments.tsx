import { motion, AnimatePresence } from 'motion/react';
import { STATUSES, STATUS_LABEL, type Status } from '../api';

/** ステータス切替。選択中を示す“しずく”がバネで滑る */
export function Segments({ value, counts, onChange }: { value: Status; counts: Record<Status, number>; onChange: (s: Status) => void }) {
  return (
    <nav className="segments glass" role="tablist" aria-label="ステータス">
      {STATUSES.map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={value === s}
          data-testid={`tab-${s}`}
          className={`segment segment-${s}`}
          onClick={() => onChange(s)}
        >
          {value === s && <motion.span layoutId="drop" className="drop" transition={{ type: 'spring', stiffness: 500, damping: 34, mass: 0.8 }} />}
          <span className="segment-label">{STATUS_LABEL[s]}</span>
          <span className="count" data-testid={`count-${s}`}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span key={counts[s]} initial={{ y: -12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}>
                {counts[s]}
              </motion.span>
            </AnimatePresence>
          </span>
        </button>
      ))}
    </nav>
  );
}
