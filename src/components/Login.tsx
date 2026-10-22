import { motion } from 'motion/react';
import { GoogleIcon, Mark } from './icons';

export function Login() {
  return (
    <motion.main
      className="login"
      data-testid="login"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.98, filter: 'blur(6px)' }}
    >
      <motion.div
        className="login-panel glass"
        initial={{ y: 30, opacity: 0, scale: 0.94 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: 0.05 }}
      >
        <motion.div initial={{ rotate: -40, scale: 0.4 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.15 }}>
          <Mark size={64} />
        </motion.div>
        <h1 className="login-title">Glass Tasks</h1>
        <motion.a className="google-btn" href="/auth/google" data-testid="google-login" whileTap={{ scale: 0.96 }}>
          <GoogleIcon />
          Googleでログイン
        </motion.a>
      </motion.div>
    </motion.main>
  );
}
