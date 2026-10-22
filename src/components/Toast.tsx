import { AnimatePresence, motion } from 'motion/react';

export interface ToastData {
  key: number;
  message: string;
  action?: { label: string; run: () => void };
}

export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  return (
    <div className="toast-zone" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.key}
            className="toast glass"
            data-testid="toast"
            initial={{ y: 40, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0, scale: 0.95 }}
          >
            <span className="toast-msg">{toast.message}</span>
            {toast.action && (
              <button
                className="toast-action"
                data-testid="toast-action"
                onClick={() => {
                  toast.action!.run();
                  onDismiss();
                }}
              >
                {toast.action.label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
