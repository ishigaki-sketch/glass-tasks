import { useEffect, type ReactNode } from 'react';
import { motion, useDragControls, type PanInfo } from 'motion/react';

/** 下から出るガラスのシート。つまみを下にスワイプ / 背景タップ / Esc で閉じる */
export function Sheet({ onClose, children, label, testId }: { onClose: () => void; children: ReactNode; label: string; testId: string }) {
  const controls = useDragControls();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 110 || info.velocity.y > 700) onClose();
  };

  return (
    <div className="sheet-root">
      <motion.div className="scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="scrim" />
      <motion.section
        className="sheet glass"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testId}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%', transition: { type: 'tween', duration: 0.22, ease: [0.4, 0, 1, 1] } }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.8 }}
        onDragEnd={onDragEnd}
      >
        <div className="grabber-zone" onPointerDown={(e) => controls.start(e)} data-testid="grabber">
          <span className="grabber" />
        </div>
        {children}
      </motion.section>
    </div>
  );
}
