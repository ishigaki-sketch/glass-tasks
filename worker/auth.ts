import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, Env, User } from './types';

const SESSION_COOKIE = 'gt_session';
const OAUTH_COOKIE = 'gt_oauth';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30日

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function sha256(input: string): Promise<string> {
  return b64url(await crypto.subtle.digest('SHA-256', enc.encode(input)));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function origin(env: Env, url: string): string {
  return env.APP_ORIGIN || new URL(url).origin;
}

function isSecure(url: string): boolean {
  return new URL(url).protocol === 'https:';
}

/** ユーザーを upsert してセッションを発行する */
async function createSession(env: Env, profile: { sub: string; email: string; name: string; picture?: string | null }) {
  const now = Date.now();
  const existing = await env.DB.prepare('SELECT id FROM users WHERE google_sub = ?').bind(profile.sub).first<{ id: string }>();
  const userId = existing?.id ?? crypto.randomUUID();
  if (existing) {
    await env.DB.prepare('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?')
      .bind(profile.email, profile.name, profile.picture ?? null, userId).run();
  } else {
    await env.DB.prepare('INSERT INTO users (id, google_sub, email, name, picture, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(userId, profile.sub, profile.email, profile.name, profile.picture ?? null, now).run();
  }
  const token = randomToken();
  await env.DB.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)')
    .bind(await sha256(token), userId, now + SESSION_TTL_MS).run();
  // 期限切れセッションの掃除（軽量なのでログイン時に実施）
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  return token;
}

export async function getUser(env: Env, token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.name, u.picture FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > ?`
  ).bind(await sha256(token), Date.now()).first<User>();
  return row ?? null;
}

export { SESSION_COOKIE };

export const auth = new Hono<AppEnv>();

/** Google の認可画面へリダイレクト（Authorization Code + PKCE） */
auth.get('/google', async (c) => {
  const env = c.env;
  if (!env.GOOGLE_CLIENT_ID) return c.text('GOOGLE_CLIENT_ID is not configured', 500);
  const state = randomToken(16);
  const verifier = randomToken(48);
  const challenge = await sha256(verifier);
  const payload = `${state}.${verifier}`;
  const sig = await hmac(env.SESSION_SECRET, payload);
  setCookie(c, OAUTH_COOKIE, `${payload}.${sig}`, {
    httpOnly: true, secure: isSecure(c.req.url), sameSite: 'Lax', path: '/auth', maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: `${origin(env, c.req.url)}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
});

auth.get('/google/callback', async (c) => {
  const env = c.env;
  const url = new URL(c.req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const raw = getCookie(c, OAUTH_COOKIE);
  deleteCookie(c, OAUTH_COOKIE, { path: '/auth' });
  if (!code || !state || !raw) return c.redirect('/?error=auth', 302);

  const [cState, verifier, sig] = raw.split('.');
  const expected = await hmac(env.SESSION_SECRET, `${cState}.${verifier}`);
  if (!sig || !timingSafeEqual(sig, expected) || !timingSafeEqual(cState, state)) {
    return c.redirect('/?error=state', 302);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${origin(env, c.req.url)}/auth/google/callback`,
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }),
  });
  if (!tokenRes.ok) return c.redirect('/?error=token', 302);
  const tokens = await tokenRes.json<{ access_token: string }>();

  // id_token を自前検証する代わりに、TLS 越しに Google の userinfo を取得して本人情報を確定
  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return c.redirect('/?error=userinfo', 302);
  const info = await infoRes.json<{ sub: string; email: string; email_verified: boolean; name?: string; picture?: string }>();
  if (!info.email_verified) return c.redirect('/?error=email', 302);

  const token = await createSession(env, { sub: info.sub, email: info.email, name: info.name ?? info.email, picture: info.picture });
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true, secure: isSecure(c.req.url), sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_MS / 1000,
  });
  return c.redirect('/', 302);
});

/** E2E テスト専用ログイン（ALLOW_DEV_LOGIN=true の環境でのみ有効） */
auth.post('/dev-login', async (c) => {
  if (c.env.ALLOW_DEV_LOGIN !== 'true') return c.notFound();
  const body = await c.req.json<{ sub?: string; name?: string; email?: string }>().catch(() => ({} as { sub?: string; name?: string; email?: string }));
  const sub = body.sub ?? 'dev-user';
  const token = await createSession(c.env, {
    sub: `dev:${sub}`, email: body.email ?? `${sub}@example.com`, name: body.name ?? 'Dev User', picture: null,
  });
  setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: 'Lax', path: '/', maxAge: SESSION_TTL_MS / 1000 });
  return c.json({ ok: true });
});

/** ログイン状態の確認（未ログインでも 200 で user: null を返す） */
auth.get('/session', async (c) => {
  c.header('cache-control', 'no-store');
  return c.json({ user: await getUser(c.env, getCookie(c, SESSION_COOKIE)) });
});

auth.post('/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: '/' });
  return c.json({ ok: true });
});
