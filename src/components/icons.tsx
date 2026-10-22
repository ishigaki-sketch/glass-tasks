const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export const PlusIcon = () => (
  <svg {...base} width={26} height={26} aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const ArrowRight = () => (
  <svg {...base} aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const ArrowLeft = () => (
  <svg {...base} aria-hidden>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const TrashIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);
export const CheckIcon = () => (
  <svg {...base} width={16} height={16} strokeWidth={3} aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);
export const SparkIcon = () => (
  <svg {...base} width={18} height={18} aria-hidden>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />
  </svg>
);
export const CloseIcon = () => (
  <svg {...base} aria-hidden>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

/** アプリのロゴマーク：3つのしずく＝3つのステータス */
export const Mark = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <circle cx="10" cy="17" r="7" fill="var(--todo)" opacity="0.85" />
    <circle cx="20" cy="11" r="6" fill="var(--doing)" opacity="0.85" />
    <circle cx="21" cy="22" r="5" fill="var(--done)" opacity="0.85" />
  </svg>
);
