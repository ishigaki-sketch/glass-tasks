export type Status = 'todo' | 'doing' | 'done';
export const STATUSES: Status[] = ['todo', 'doing', 'done'];
export const STATUS_LABEL: Record<Status, string> = { todo: 'やること', doing: '進行中', done: '完了' };

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  status: Status;
  subtasks: Subtask[];
  position: number;
  createdAt: number;
  updatedAt: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  session: () => request<{ user: User | null }>('/auth/session'),
  me: () => request<User>('/api/me'),
  tasks: () => request<Task[]>('/api/tasks'),
  create: (t: { id: string; title: string; status?: Status }) =>
    request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(t) }),
  update: (id: string, patch: Partial<Pick<Task, 'title' | 'note' | 'status' | 'subtasks' | 'position'>>) =>
    request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  remove: (id: string) => request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  breakdown: (id: string) => request<Task>(`/api/tasks/${id}/breakdown`, { method: 'POST' }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
};

export const uid = () => crypto.randomUUID();
