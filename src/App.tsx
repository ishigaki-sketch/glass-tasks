import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { api, ApiError, uid, type Status, type Task, type User } from './api';
import { Backdrop } from './components/Backdrop';
import { Skeleton } from './components/Skeleton';
import { Login } from './components/Login';
import { Header } from './components/Header';
import { Segments } from './components/Segments';
import { TaskList } from './components/TaskList';
import { AddSheet } from './components/AddSheet';
import { DetailSheet } from './components/DetailSheet';
import { Toast, type ToastData } from './components/Toast';
import { PlusIcon } from './components/icons';

type Phase = 'loading' | 'anon' | 'ready';

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tab, setTab] = useState<Status>('todo');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<number>(undefined);

  const showToast = useCallback((t: Omit<ToastData, 'key'>) => {
    window.clearTimeout(toastTimer.current);
    setToast({ ...t, key: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), t.action ? 4500 : 2400);
  }, []);

  const fail = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        setPhase('anon');
        return;
      }
      showToast({ message: '保存できませんでした。通信状況を確認してください' });
    },
    [showToast]
  );

  useEffect(() => {
    (async () => {
      try {
        const { user: me } = await api.session();
        if (!me) return setPhase('anon');
        const list = await api.tasks();
        setUser(me);
        setTasks(list);
        setPhase('ready');
      } catch {
        setPhase('anon');
      }
    })();
  }, []);

  useEffect(() => {
    const err = new URLSearchParams(location.search).get('error');
    if (err) {
      showToast({ message: 'Googleログインに失敗しました。もう一度お試しください' });
      history.replaceState(null, '', '/');
    }
  }, [showToast]);

  const counts = useMemo(() => {
    const c = { todo: 0, doing: 0, done: 0 } as Record<Status, number>;
    for (const t of tasks) c[t.status]++;
    return c;
  }, [tasks]);

  const visible = useMemo(() => tasks.filter((t) => t.status === tab), [tasks, tab]);
  const openTask = tasks.find((t) => t.id === openId) ?? null;

  const patchLocal = (id: string, patch: Partial<Task>) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const addTask = async (title: string) => {
    const id = uid();
    const minPos = tasks.reduce((m, t) => Math.min(m, t.position), 0);
    const draft: Task = { id, title, note: '', status: tab, subtasks: [], position: minPos - 1, createdAt: Date.now(), updatedAt: Date.now() };
    setTasks((prev) => [draft, ...prev]);
    try {
      const saved = await api.create({ id, title, status: tab });
      patchLocal(id, saved);
    } catch (e) {
      setTasks((prev) => prev.filter((t) => t.id !== id));
      fail(e);
    }
  };

  const moveTask = async (task: Task, to: Status) => {
    const minPos = tasks.reduce((m, t) => Math.min(m, t.position), 0);
    patchLocal(task.id, { status: to, position: minPos - 1 });
    showToast({
      message: `「${task.title}」を${to === 'todo' ? 'やること' : to === 'doing' ? '進行中' : '完了'}に移動しました`,
      action: { label: '元に戻す', run: () => moveTask({ ...task, status: to }, task.status) },
    });
    try {
      await api.update(task.id, { status: to, position: minPos - 1 });
    } catch (e) {
      patchLocal(task.id, { status: task.status, position: task.position });
      fail(e);
    }
  };

  const deleteTask = async (task: Task) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    setOpenId(null);
    let undone = false;
    showToast({
      message: `「${task.title}」を削除しました`,
      action: {
        label: '元に戻す',
        run: async () => {
          undone = true;
          setTasks((prev) => [...prev, task].sort((a, b) => a.position - b.position));
          try {
            const saved = await api.create({ id: task.id, title: task.title, status: task.status });
            const restored = await api.update(saved.id, { note: task.note, subtasks: task.subtasks, position: task.position });
            patchLocal(task.id, restored);
          } catch (e) {
            fail(e);
          }
        },
      },
    });
    try {
      await api.remove(task.id);
    } catch (e) {
      if (!undone) {
        setTasks((prev) => [...prev, task].sort((a, b) => a.position - b.position));
        fail(e);
      }
    }
  };

  const saveTask = async (id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'subtasks'>>) => {
    const before = tasks.find((t) => t.id === id);
    patchLocal(id, patch);
    try {
      await api.update(id, patch);
    } catch (e) {
      if (before) patchLocal(id, before);
      fail(e);
    }
  };

  const breakdown = async (id: string) => {
    try {
      const updated = await api.breakdown(id);
      patchLocal(id, updated);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return fail(e);
      showToast({ message: 'AIでの分解に失敗しました。少し待ってから再実行してください' });
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setTasks([]);
      setTab('todo');
      setPhase('anon');
    }
  };

  return (
    <MotionConfig reducedMotion="user" transition={{ type: 'spring', stiffness: 420, damping: 36 }}>
      <Backdrop tone={phase === 'ready' ? tab : 'todo'} />
      <AnimatePresence mode="wait">
        {phase === 'loading' && <Skeleton key="skeleton" />}
        {phase === 'anon' && <Login key="login" />}
        {phase === 'ready' && user && (
          <motion.main
            key="app"
            className="app"
            initial={{ opacity: 0, scale: 0.985, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(6px)' }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            <Header user={user} onLogout={logout} />
            <Segments value={tab} counts={counts} onChange={setTab} />
            <TaskList tab={tab} tasks={visible} onMove={moveTask} onDelete={deleteTask} onOpen={(t) => setOpenId(t.id)} />
            <motion.button
              className="fab glass"
              aria-label="タスクを追加"
              data-testid="fab"
              onClick={() => setAdding(true)}
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.25, type: 'spring', stiffness: 380, damping: 22 }}
              whileTap={{ scale: 0.88 }}
            >
              <PlusIcon />
            </motion.button>
          </motion.main>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {adding && <AddSheet key="add" status={tab} onAdd={addTask} onClose={() => setAdding(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {openTask && (
          <DetailSheet
            key="detail"
            task={openTask}
            onClose={() => setOpenId(null)}
            onSave={(p) => saveTask(openTask.id, p)}
            onMove={(to) => moveTask(openTask, to)}
            onDelete={() => deleteTask(openTask)}
            onBreakdown={() => breakdown(openTask.id)}
          />
        )}
      </AnimatePresence>
      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </MotionConfig>
  );
}
