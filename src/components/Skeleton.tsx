import { motion } from 'motion/react';

/** 全画面スケルトン：実際の画面と同じ骨格（ヘッダー・切替・カード・追加ボタン）を描く */
export function Skeleton() {
  return (
    <motion.div
      className="app skeleton"
      data-testid="skeleton"
      aria-busy="true"
      aria-label="読み込み中"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(8px)' }}
      transition={{ duration: 0.3 }}
    >
      <div className="header">
        <div className="brand">
          <span className="sk sk-circle" style={{ width: 28, height: 28 }} />
          <span className="sk sk-line" style={{ width: 96, height: 18 }} />
        </div>
        <span className="sk sk-circle" style={{ width: 36, height: 36 }} />
      </div>
      <div className="segments glass">
        {[0, 1, 2].map((i) => (
          <span key={i} className="sk sk-pill" />
        ))}
      </div>
      <div className="list">
        {[78, 54, 66, 40, 70, 48].map((w, i) => (
          <motion.div
            key={i}
            className="card glass sk-card"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <span className="sk sk-line" style={{ width: `${w}%`, height: 16 }} />
            <span className="sk sk-line" style={{ width: '32%', height: 10, marginTop: 12 }} />
          </motion.div>
        ))}
      </div>
      <span className="fab glass sk-fab">
        <span className="sk sk-circle" style={{ width: 26, height: 26 }} />
      </span>
    </motion.div>
  );
}
