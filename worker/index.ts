import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';
import { secureHeaders } from 'hono/secure-headers';
import { auth, getUser, SESSION_COOKIE } from './auth';
import { breakdownTask } from './ai';
import { STATUSES, type AppEnv, type Status, type Subtask, type TaskRow } from './types';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders());
// 状態を変えるリクエストは同一オリジンからのみ受け付ける（CSRF 対策）
const sameOrigin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.req.method === 'GET' || c.req.method === 'HEAD') return next();
  const origin = c.req.header('origin');
  const allowed = [new URL(c.req.url).origin, c.env.APP_ORIGIN].filter(Boolean);
  if (!origin || !allowed.includes(origin)) return c.json({ error: 'forbidden' }, 403);
  await next();
});
app.use('/api/*', sameOrigin);
app.use('/auth/logout', sameOrigin);
app.use('/auth/dev-login', sameOrigin);

app.route('/auth', auth);

const api = new Hono<AppEnv>();

api.use('*', async (c, next) => {
  const user = await getUser(c.env, getCookie(c, SESSION_COOKIE));
  if (!user) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', user);
  await next();
});

function toTask(r: TaskRow) {
  return {
    id: r.id,
    title: r.title,
    note: r.note,
    status: r.status,
    subtasks: JSON.parse(r.subtasks) as Subtask[],
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function isStatus(v: unknown): v is Status {
  return typeof v === 'string' && (STATUSES as string[]).includes(v);
}

function cleanTitle(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 200);
  return t || null;
}

function cleanSubtasks(v: unknown): Subtask[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((s) => s && typeof s.title === 'string' && s.title.trim())
    .slice(0, 50)
    .map((s) => ({ id: typeof s.id === 'string' ? s.id.slice(0, 64) : crypto.randomUUID(), title: s.title.trim().slice(0, 120), done: !!s.done }));
}

api.get('/me', (c) => c.json(c.get('user')));

api.get('/tasks', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM tasks WHERE user_id = ? ORDER BY position ASC')
    .bind(c.get('user').id).all<TaskRow>();
  return c.json(results.map(toTask));
});

api.post('/tasks', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const title = cleanTitle(body.title);
  if (!title) return c.json({ error: 'title is required' }, 400);
  const status: Status = isStatus(body.status) ? body.status : 'todo';
  const userId = c.get('user').id;
  const min = await c.env.DB.prepare('SELECT MIN(position) AS p FROM tasks WHERE user_id = ?').bind(userId).first<{ p: number | null }>();
  const now = Date.now();
  const row: TaskRow = {
    id: typeof body.id === 'string' && /^[\w-]{8,64}$/.test(body.id) ? body.id : crypto.randomUUID(),
    user_id: userId,
    title,
    note: typeof body.note === 'string' ? body.note.slice(0, 2000) : '',
    status,
    subtasks: '[]',
    position: (min?.p ?? 0) - 1, // 新しいタスクは先頭へ
    created_at: now,
    updated_at: now,
  };
  await c.env.DB.prepare(
    'INSERT INTO tasks (id, user_id, title, note, status, subtasks, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(row.id, row.user_id, row.title, row.note, row.status, row.subtasks, row.position, row.created_at, row.updated_at).run();
  return c.json(toTask(row), 201);
});

api.patch('/tasks/:id', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const sets: string[] = [];
  const vals: unknown[] = [];
  if ('title' in body) {
    const t = cleanTitle(body.title);
    if (!t) return c.json({ error: 'invalid title' }, 400);
    sets.push('title = ?'); vals.push(t);
  }
  if ('note' in body) {
    if (typeof body.note !== 'string') return c.json({ error: 'invalid note' }, 400);
    sets.push('note = ?'); vals.push(body.note.slice(0, 2000));
  }
  if ('status' in body) {
    if (!isStatus(body.status)) return c.json({ error: 'invalid status' }, 400);
    sets.push('status = ?'); vals.push(body.status);
  }
  if ('subtasks' in body) {
    const s = cleanSubtasks(body.subtasks);
    if (!s) return c.json({ error: 'invalid subtasks' }, 400);
    sets.push('subtasks = ?'); vals.push(JSON.stringify(s));
  }
  if ('position' in body) {
    if (typeof body.position !== 'number' || !Number.isFinite(body.position)) return c.json({ error: 'invalid position' }, 400);
    sets.push('position = ?'); vals.push(body.position);
  }
  if (!sets.length) return c.json({ error: 'nothing to update' }, 400);
  sets.push('updated_at = ?'); vals.push(Date.now());

  const row = await c.env.DB.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_id = ? RETURNING *`)
    .bind(...vals, c.req.param('id'), c.get('user').id).first<TaskRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  return c.json(toTask(row));
});

api.delete('/tasks/:id', async (c) => {
  const res = await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id).run();
  if (!res.meta.changes) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});

api.post('/tasks/:id/breakdown', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?')
    .bind(c.req.param('id'), c.get('user').id).first<TaskRow>();
  if (!row) return c.json({ error: 'not found' }, 404);
  let titles: string[];
  try {
    titles = await breakdownTask(c.env, row.title, row.note);
  } catch (e) {
    console.error('AI breakdown failed', e);
    return c.json({ error: 'ai_failed' }, 502);
  }
  if (!titles.length) return c.json({ error: 'ai_empty' }, 502);
  const existing = JSON.parse(row.subtasks) as Subtask[];
  const merged = [...existing, ...titles.map((t) => ({ id: crypto.randomUUID(), title: t, done: false }))].slice(0, 50);
  const updated = await c.env.DB.prepare('UPDATE tasks SET subtasks = ?, updated_at = ? WHERE id = ? RETURNING *')
    .bind(JSON.stringify(merged), Date.now(), row.id).first<TaskRow>();
  return c.json(toTask(updated!));
});

app.route('/api', api);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'internal' }, 500);
});

export default app;
