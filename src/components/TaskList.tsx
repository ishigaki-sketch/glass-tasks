import { useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useTransform, type PanInfo } from 'motion/react';
import { STATUSES, STATUS_LABEL, type Status, type Task } from '../api';
import { ArrowLeft, ArrowRight, TrashIcon } from './icons';

const THRESHOLD = 96; // px：これ以上引くと確定
const VELOCITY = 600; // px/s：素早いフリックなら距離が短くても確定

const next = (s: Status): Status | null => STATUSES[STATUSES.indexOf(s) + 1] ?? null;
const prev = (s: Status): Status | null => STATUSES[STATUSES.indexOf(s) - 1] ?? null;

interface Props {
  tab: Status;
  tasks: Task[];
  onMove: (t: Task, to: Status) => void;
  onDelete: (t: Task) => void;
  onOpen: (t: Task) => void;
}

export function TaskList({ tab, tasks, onMove, onDelete, onOpen }: Props) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.ul
        key={tab}
        className="list"
        data-testid={`list-${tab}`}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <AnimatePresence initial={false}>
          {tasks.map((t, i) => (
            <TaskCard key={t.id} task={t} index={i} onMove={onMove} onDelete={onDelete} onOpen={onOpen} />
          ))}
        </AnimatePresence>
        <AnimatePresence>{tasks.length === 0 && <Empty key="empty" tab={tab} />}</AnimatePresence>
      </motion.ul>
    </AnimatePresence>
  );
}

function Empty({ tab }: { tab: Status }) {
  const text = tab === 'todo' ? '＋ からタスクを追加' : tab === 'doing' ? '右にフリックしたタスクがここに入ります' : '完了したタスクはまだありません';
  return (
    <motion.li className="empty" data-testid="empty" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
      <span className={`empty-drop drop-${tab}`} />
      {text}
    </motion.li>
  );
}

function TaskCard({ task, index, onMove, onDelete, onOpen }: Omit<Props, 'tasks' | 'tab'> & { task: Task; index: number }) {
  const x = useMotionValue(0);
  const dragged = useRef(false);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const right = next(task.status);
  const left = prev(task.status);

  const rotate = useTransform(x, [-220, 0, 220], [-5, 0, 5]);
  const rightOpacity = useTransform(x, [0, THRESHOLD], [0, 1]);
  const leftOpacity = useTransform(x, [-THRESHOLD, 0], [1, 0]);
  const rightScale = useTransform(x, [0, THRESHOLD, THRESHOLD + 40], [0.6, 1, 1.12]);
  const leftScale = useTransform(x, [-THRESHOLD - 40, -THRESHOLD, 0], [1.12, 1, 0.6]);

  const done = task.subtasks.filter((s) => s.done).length;
  const total = task.subtasks.length;

  const commit = async (dir: 1 | -1) => {
    navigator.vibrate?.(12);
    setLeaving(dir);
    await animate(x, dir * (window.innerWidth + 80), { type: 'tween', duration: 0.22, ease: [0.4, 0, 1, 1] });
    if (dir === 1 && right) onMove(task, right);
    else if (dir === -1 && left) onMove(task, left);
    else if (dir === -1 && !left) onDelete(task);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x;
    const vx = info.velocity.x;
    if ((dx > THRESHOLD || (vx > VELOCITY && dx > 24)) && right) return void commit(1);
    if (dx < -THRESHOLD || (vx < -VELOCITY && dx < -24)) return void commit(-1);
    animate(x, 0, { type: 'spring', stiffness: 520, damping: 30 });
  };

  return (
    <motion.li
      className="card-wrap"
      data-testid="task"
      data-task-id={task.id}
      layout
      initial={{ opacity: 0, y: -14, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: Math.min(index, 8) * 0.03 } }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, transition: { duration: 0.25 } }}
    >
      {/* カードを引くと、空いた側に移動先の色がにじみ出てラベルが現れる */}
      <div className="reveal" aria-hidden>
        {right && <motion.span className={`reveal-tint tint-${right} tint-from-left`} style={{ opacity: rightOpacity }} />}
        <motion.span className={`reveal-tint tint-${left ?? 'delete'} tint-from-right`} style={{ opacity: leftOpacity }} />
        {right && (
          <motion.span className={`reveal-side reveal-next to-${right}`} style={{ opacity: rightOpacity, scale: rightScale }}>
            {STATUS_LABEL[right]} <ArrowRight />
          </motion.span>
        )}
        <motion.span className={`reveal-side reveal-prev to-${left ?? 'delete'}`} style={{ opacity: leftOpacity, scale: leftScale }}>
          {left ? (
            <>
              <ArrowLeft /> {STATUS_LABEL[left]}
            </>
          ) : (
            <>
              <TrashIcon /> 削除
            </>
          )}
        </motion.span>
      </div>
      <motion.button
        className={`card glass status-${task.status}`}
        data-testid="task-card"
        drag={leaving ? false : 'x'}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.9, right: right ? 0.9 : 0.15 }}
        dragMomentum={false}
        style={{ x, rotate }}
        onPointerDown={() => (dragged.current = false)}
        onDragStart={() => (dragged.current = true)}
        onDragEnd={onDragEnd}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onOpen(task);
        }}
        whileTap={{ scale: 0.985 }}
        aria-label={`${task.title}（${STATUS_LABEL[task.status]}）`}
      >
        <span className={`dot dot-${task.status}`} />
        <span className="card-body">
          <span className="card-title" data-testid="task-title">
            {task.title}
          </span>
          {total > 0 && (
            <span className="progress" data-testid="progress">
              <span className="progress-track">
                <motion.span className="progress-fill" initial={false} animate={{ width: `${(done / total) * 100}%` }} />
              </span>
              <span className="progress-text">
                {done}/{total}
              </span>
            </span>
          )}
        </span>
      </motion.button>
    </motion.li>
  );
}
