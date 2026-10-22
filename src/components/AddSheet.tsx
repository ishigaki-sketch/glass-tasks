import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { STATUS_LABEL, type Status } from '../api';
import { Sheet } from './Sheet';

export function AddSheet({ status, onAdd, onClose }: { status: Status; onAdd: (title: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [added, setAdded] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 120);
    return () => clearTimeout(t);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    onAdd(t);
    setTitle('');
    setAdded((n) => n + 1);
    input.current?.focus();
  };

  return (
    <Sheet onClose={onClose} label="タスクを追加" testId="add-sheet">
      <form className="add-form" onSubmit={submit}>
        <label className="field-label" htmlFor="new-title">
          {STATUS_LABEL[status]}に追加
        </label>
        <div className="add-row">
          <input
            id="new-title"
            ref={input}
            className="input"
            data-testid="new-title"
            value={title}
            maxLength={200}
            autoComplete="off"
            enterKeyHint="done"
            placeholder="タスク名"
            onChange={(e) => setTitle(e.target.value)}
          />
          <motion.button
            type="submit"
            className="btn btn-primary"
            data-testid="add-submit"
            disabled={!title.trim()}
            whileTap={{ scale: 0.94 }}
            animate={added ? { scale: [1, 1.12, 1] } : undefined}
            key={added}
          >
            追加
          </motion.button>
        </div>
      </form>
    </Sheet>
  );
}
