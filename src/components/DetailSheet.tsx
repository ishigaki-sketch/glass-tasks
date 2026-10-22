import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { STATUSES, STATUS_LABEL, uid, type Status, type Subtask, type Task } from '../api';
import { Sheet } from './Sheet';
import { CheckIcon, CloseIcon, SparkIcon, TrashIcon } from './icons';

interface Props {
  task: Task;
  onClose: () => void;
  onSave: (p: Partial<Pick<Task, 'title' | 'note' | 'subtasks'>>) => void;
  onMove: (to: Status) => void;
  onDelete: () => void;
  onBreakdown: () => Promise<void>;
}

export function DetailSheet({ task, onClose, onSave, onMove, onDelete, onBreakdown }: Props) {
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note);
  const [newSub, setNewSub] = useState('');
  const [thinking, setThinking] = useState(false);

  const commitTitle = () => {
    const t = title.trim();
    if (!t) return setTitle(task.title);
    if (t !== task.title) onSave({ title: t });
  };
  const commitNote = () => note !== task.note && onSave({ note });
  const setSubs = (subtasks: Subtask[]) => onSave({ subtasks });

  const runAI = async () => {
    setThinking(true);
    navigator.vibrate?.(8);
    await onBreakdown();
    setThinking(false);
  };

  return (
    <Sheet onClose={onClose} label="タスクの詳細" testId="detail-sheet">
      <div className="detail">
        <div className="detail-head">
          <input
            className="title-input"
            data-testid="detail-title"
            aria-label="タスク名"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          />
          <button className="icon-btn" aria-label="閉じる" onClick={onClose} data-testid="detail-close">
            <CloseIcon />
          </button>
        </div>

        <div className="status-row" role="radiogroup" aria-label="ステータス">
          {STATUSES.map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={task.status === s}
              className={`status-chip chip-${s} ${task.status === s ? 'is-on' : ''}`}
              data-testid={`detail-status-${s}`}
              onClick={() => task.status !== s && onMove(s)}
            >
              {task.status === s && <motion.span layoutId="chip" className="chip-bg" />}
              <span>{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>

        <textarea
          className="input note"
          data-testid="detail-note"
          aria-label="メモ"
          placeholder="メモ"
          rows={3}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={commitNote}
        />

        <div className="subs-head">
          <h2 className="subs-title">サブタスク</h2>
          <motion.button className={`btn btn-ai ${thinking ? 'is-thinking' : ''}`} data-testid="ai-breakdown" onClick={runAI} disabled={thinking} whileTap={{ scale: 0.95 }}>
            <motion.span animate={thinking ? { rotate: 360 } : { rotate: 0 }} transition={thinking ? { repeat: Infinity, duration: 1.2, ease: 'linear' } : {}} style={{ display: 'inline-flex' }}>
              <SparkIcon />
            </motion.span>
            {thinking ? '分解中…' : 'AIで分解'}
          </motion.button>
        </div>

        <ul className="subs" data-testid="subtasks">
          <AnimatePresence initial={false}>
            {thinking &&
              [0, 1, 2].map((i) => (
                <motion.li key={`sk${i}`} className="sub sub-skeleton" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 44 }} exit={{ opacity: 0, height: 0 }} transition={{ delay: i * 0.08 }}>
                  <span className="sk sk-line" style={{ width: `${70 - i * 15}%`, height: 12 }} />
                </motion.li>
              ))}
            {task.subtasks.map((s, i) => (
              <motion.li
                key={s.id}
                layout
                className={`sub ${s.done ? 'is-done' : ''}`}
                data-testid="subtask"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0, transition: { delay: i * 0.05 } }}
                exit={{ opacity: 0, height: 0 }}
              >
                <button
                  className="check"
                  role="checkbox"
                  aria-checked={s.done}
                  aria-label={s.title}
                  data-testid="subtask-check"
                  onClick={() => setSubs(task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                >
                  <AnimatePresence>
                    {s.done && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'inline-flex' }}>
                        <CheckIcon />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
                <span className="sub-title">{s.title}</span>
                <button className="icon-btn sm" aria-label={`${s.title}を削除`} onClick={() => setSubs(task.subtasks.filter((x) => x.id !== s.id))}>
                  <CloseIcon />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>

        <form
          className="add-row"
          onSubmit={(e) => {
            e.preventDefault();
            const t = newSub.trim();
            if (!t) return;
            setSubs([...task.subtasks, { id: uid(), title: t, done: false }]);
            setNewSub('');
          }}
        >
          <input className="input" data-testid="new-subtask" placeholder="サブタスクを追加" maxLength={120} value={newSub} onChange={(e) => setNewSub(e.target.value)} />
          <button className="btn" type="submit" disabled={!newSub.trim()} data-testid="add-subtask">
            追加
          </button>
        </form>

        <button className="btn btn-danger" onClick={onDelete} data-testid="detail-delete">
          <TrashIcon /> タスクを削除
        </button>
      </div>
    </Sheet>
  );
}
