export interface Env {
  DB: D1Database;
  AI?: Ai;
  ASSETS: Fetcher;
  AI_MODEL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  APP_ORIGIN: string;
  ALLOW_DEV_LOGIN?: string;
}

export type Status = 'todo' | 'doing' | 'done';
export const STATUSES: Status[] = ['todo', 'doing', 'done'];

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  note: string;
  status: Status;
  subtasks: string;
  position: number;
  created_at: number;
  updated_at: number;
}

export type AppEnv = { Bindings: Env; Variables: { user: User } };
