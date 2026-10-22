import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { User } from '../api';
import { Mark } from './icons';

export function Header({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <header className="header">
      <div className="brand">
        <Mark />
        <span className="brand-name">Glass Tasks</span>
      </div>
      <div className="account" ref={ref}>
        <motion.button className="avatar glass" aria-label="アカウント" aria-expanded={open} data-testid="avatar" onClick={() => setOpen((v) => !v)} whileTap={{ scale: 0.9 }}>
          {user.picture ? <img src={user.picture} alt="" referrerPolicy="no-referrer" /> : <span>{user.name.slice(0, 1)}</span>}
        </motion.button>
        <AnimatePresence>
          {open && (
            <motion.div
              className="menu glass"
              role="menu"
              initial={{ opacity: 0, scale: 0.8, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -6 }}
              style={{ transformOrigin: 'top right' }}
            >
              <div className="menu-user">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
              <button role="menuitem" className="menu-item" data-testid="logout" onClick={onLogout}>
                ログアウト
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}
