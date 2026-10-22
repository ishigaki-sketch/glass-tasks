import { expect, test } from '@playwright/test';
import { addTask, card, collectErrors, expectCounts, expectNoHorizontalOverflow, flick, login, ORIGIN, touchFlick } from './helpers';

test.describe('ログイン', () => {
  test('未ログイン時はGoogleログインだけが表示され、余計な文言がない', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    const panel = page.getByTestId('login');
    await expect(panel).toBeVisible();
    await expect(page.getByTestId('google-login')).toHaveAttribute('href', '/auth/google');
    // 表示テキストはアプリ名とボタンのみ（キャッチコピーなし）
    const text = (await panel.innerText()).split('\n').map((s) => s.trim()).filter(Boolean);
    expect(text).toEqual(['Glass Tasks', 'Googleでログイン']);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('Googleログインは PKCE 付きの認可リクエストへリダイレクトする', async ({ request }) => {
    const res = await request.get('/auth/google', { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const loc = new URL(res.headers()['location']);
    expect(loc.origin + loc.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(loc.searchParams.get('client_id')).toBe('e2e-client-id.apps.googleusercontent.com');
    expect(loc.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/google/callback`);
    expect(loc.searchParams.get('scope')).toBe('openid email profile');
    expect(loc.searchParams.get('code_challenge_method')).toBe('S256');
    expect(loc.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
    expect(loc.searchParams.get('state')).toBeTruthy();
    const cookie = res.headers()['set-cookie'];
    expect(cookie).toContain('gt_oauth=');
    expect(cookie).toContain('HttpOnly');
  });

  test('state が一致しないコールバックは拒否され、エラーが表示される', async ({ page }) => {
    await page.goto('/auth/google/callback?code=x&state=forged');
    await expect(page).toHaveURL(`${ORIGIN}/`);
    await expect(page.getByTestId('toast')).toContainText('Googleログインに失敗しました');
    await expect(page.getByTestId('login')).toBeVisible();
  });

  test('ログアウトするとログイン画面に戻り、セッションが無効になる', async ({ page }) => {
    await login(page);
    await page.getByTestId('avatar').click();
    await page.getByTestId('logout').click();
    await expect(page.getByTestId('login')).toBeVisible();
    const res = await page.request.get('/api/tasks');
    expect(res.status()).toBe(401);
    await page.reload();
    await expect(page.getByTestId('login')).toBeVisible();
  });
});

test.describe('スケルトンローディング', () => {
  test('読み込み中は画面全体に骨組みが表示され、読み込み後に消える', async ({ page }) => {
    await login(page);
    await addTask(page, 'スケルトン確認');
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/api/tasks', async (route) => {
      await gate;
      await route.continue();
    });
    await page.reload();
    const sk = page.getByTestId('skeleton');
    await expect(sk).toBeVisible();
    await expect(sk).toHaveAttribute('aria-busy', 'true');
    const box = (await sk.boundingBox())!;
    const vp = page.viewportSize()!;
    expect(box.height).toBeGreaterThanOrEqual(vp.height - 1);
    expect(await sk.locator('.sk-card').count()).toBeGreaterThanOrEqual(5);
    await expect(page.getByTestId('fab')).toHaveCount(0);
    release();
    await expect(sk).toBeHidden();
    await expect(card(page, 'スケルトン確認')).toBeVisible();
  });
});

test.describe('タスク操作', () => {
  test('追加したタスクが先頭に並び、リロード後も残る', async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await expect(page.getByTestId('empty')).toBeVisible();
    await addTask(page, '一つ目');
    await addTask(page, '二つ目');
    await expectCounts(page, 2, 0, 0);
    await expect(page.getByTestId('task-title').first()).toHaveText('二つ目');
    await page.reload();
    await expect(page.getByTestId('task-title')).toHaveText(['二つ目', '一つ目']);
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });

  test('右フリックで やること → 進行中 → 完了 と進む', async ({ page }) => {
    await login(page);
    await addTask(page, 'フリック対象');
    const patch = page.waitForResponse((r) => r.request().method() === 'PATCH');
    await flick(page, card(page, 'フリック対象'), 220);
    expect((await patch).status()).toBe(200);
    await expectCounts(page, 0, 1, 0);
    await expect(page.getByTestId('toast')).toContainText('進行中に移動しました');

    await page.getByTestId('tab-doing').click();
    await expect(page.getByTestId('tab-doing')).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, 'フリック対象')).toBeVisible();
    await flick(page, card(page, 'フリック対象'), 220);
    await expectCounts(page, 0, 0, 1);

    await page.getByTestId('tab-done').click();
    await expect(card(page, 'フリック対象')).toBeVisible();
    await page.reload();
    await expectCounts(page, 0, 0, 1);
  });

  test('左フリックで一つ前のステータスに戻り、短いドラッグでは何も変わらない', async ({ page }) => {
    await login(page);
    await addTask(page, '戻すタスク');
    await flick(page, card(page, '戻すタスク'), 220);
    await expectCounts(page, 0, 1, 0);
    await page.getByTestId('tab-doing').click();

    // しきい値未満のドラッグはバネで元の位置に戻るだけ
    await flick(page, card(page, '戻すタスク'), -50);
    await page.waitForTimeout(500);
    await expectCounts(page, 0, 1, 0);
    const box = (await card(page, '戻すタスク').boundingBox())!;
    const wrap = (await page.getByTestId('task').filter({ hasText: '戻すタスク' }).boundingBox())!;
    expect(Math.abs(box.x - wrap.x)).toBeLessThan(2);

    await flick(page, card(page, '戻すタスク'), -220);
    await expectCounts(page, 1, 0, 0);
    await page.getByTestId('tab-todo').click();
    await expect(card(page, '戻すタスク')).toBeVisible();
  });

  test('指でのフリック（タッチ操作）でもステータスが変わる', async ({ page }) => {
    await login(page);
    await addTask(page, 'タッチで動かす');
    await touchFlick(page, card(page, 'タッチで動かす'), 230);
    await expectCounts(page, 0, 1, 0);
  });

  test('完了タブで右フリックしてもそれ以上進まない', async ({ page }) => {
    await login(page);
    await addTask(page, '最後まで');
    await flick(page, card(page, '最後まで'), 220);
    await expectCounts(page, 0, 1, 0);
    await page.getByTestId('tab-doing').click();
    await flick(page, card(page, '最後まで'), 220);
    await expectCounts(page, 0, 0, 1);
    await page.getByTestId('tab-done').click();
    await flick(page, card(page, '最後まで'), 260);
    await page.waitForTimeout(500);
    await expectCounts(page, 0, 0, 1);
    await expect(card(page, '最後まで')).toBeVisible();
  });

  test('やることで左フリックすると削除され、元に戻すで復元できる', async ({ page }) => {
    await login(page);
    await addTask(page, '消すタスク');
    await addTask(page, '残すタスク');
    const del = page.waitForResponse((r) => r.request().method() === 'DELETE');
    await flick(page, card(page, '消すタスク'), -230);
    expect((await del).status()).toBe(204);
    await expectCounts(page, 1, 0, 0);
    await expect(page.getByTestId('toast')).toContainText('削除しました');
    await page.getByTestId('toast-action').click();
    await expect(card(page, '消すタスク')).toBeVisible();
    await expectCounts(page, 2, 0, 0);
    await page.waitForTimeout(400);
    await page.reload();
    await expect(page.getByTestId('task-title')).toHaveText(['残すタスク', '消すタスク']);
  });

  test('移動の「元に戻す」で元のステータスに戻る', async ({ page }) => {
    await login(page);
    await addTask(page, 'うっかり移動');
    await flick(page, card(page, 'うっかり移動'), 220);
    await expectCounts(page, 0, 1, 0);
    await page.getByTestId('toast-action').click();
    await expectCounts(page, 1, 0, 0);
    await expect(card(page, 'うっかり移動')).toBeVisible();
  });
});

test.describe('詳細シート・AI', () => {
  test('タップで詳細を開き、タイトルとメモを編集できる', async ({ page }) => {
    await login(page);
    await addTask(page, '編集前');
    await card(page, '編集前').click();
    const sheet = page.getByTestId('detail-sheet');
    await expect(sheet).toBeVisible();
    await page.getByTestId('detail-title').fill('編集後のタイトル');
    await page.getByTestId('detail-title').press('Enter');
    await page.getByTestId('detail-note').fill('メモの内容');
    const saved = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.request().postData()!.includes('note'));
    await page.getByTestId('detail-close').click(); // blur でメモ保存
    await saved;
    await expect(sheet).toBeHidden();
    await expect(card(page, '編集後のタイトル')).toBeVisible();
    await page.reload();
    await card(page, '編集後のタイトル').click();
    await expect(page.getByTestId('detail-note')).toHaveValue('メモの内容');
    await expectNoHorizontalOverflow(page);
  });

  test('AIで分解するとサブタスクが追加され、チェックで進捗がカードに反映される', async ({ page }) => {
    const errors = collectErrors(page);
    await login(page);
    await addTask(page, '月次資料を準備する');
    await card(page, '月次資料を準備する').click();
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route('**/breakdown', async (route) => {
      await gate;
      await route.continue();
    });
    await page.getByTestId('ai-breakdown').click();
    await expect(page.getByTestId('ai-breakdown')).toHaveText('分解中…');
    await expect(page.locator('.sub-skeleton')).toHaveCount(3);
    release();
    await expect(page.getByTestId('subtask')).toHaveCount(3);
    await expect(page.getByTestId('subtask').first()).toContainText('月次資料を準備する');
    await expect(page.getByTestId('ai-breakdown')).toHaveText('AIで分解');

    await page.getByTestId('subtask-check').first().click();
    await expect(page.getByTestId('subtask-check').first()).toHaveAttribute('aria-checked', 'true');
    await page.getByTestId('new-subtask').fill('手動で追加');
    await page.getByTestId('add-subtask').click();
    await expect(page.getByTestId('subtask')).toHaveCount(4);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('task').filter({ hasText: '月次資料を準備する' }).getByTestId('progress')).toContainText('1/4');
    await page.waitForTimeout(300);
    await page.reload();
    await expect(page.getByTestId('task').filter({ hasText: '月次資料を準備する' }).getByTestId('progress')).toContainText('1/4');
    expect(errors).toEqual([]);
  });

  test('詳細のステータス切替と削除ができる', async ({ page }) => {
    await login(page);
    await addTask(page, '詳細から操作');
    await card(page, '詳細から操作').click();
    await page.getByTestId('detail-status-done').click();
    await expect(page.getByTestId('detail-status-done')).toHaveAttribute('aria-checked', 'true');
    await expectCounts(page, 0, 0, 1);
    await page.getByTestId('detail-delete').click();
    await expect(page.getByTestId('detail-sheet')).toBeHidden();
    await expectCounts(page, 0, 0, 0);
  });

  test('背景タップで追加シートが閉じる', async ({ page }) => {
    await login(page);
    await page.getByTestId('fab').click();
    await expect(page.getByTestId('add-sheet')).toBeVisible();
    await page.mouse.click(20, 40);
    await expect(page.getByTestId('add-sheet')).toBeHidden();
  });
});

test.describe('API の安全性', () => {
  test('未ログインの API は 401', async ({ request }) => {
    expect((await request.get('/api/tasks')).status()).toBe(401);
    expect((await request.post('/api/tasks', { headers: { origin: ORIGIN }, data: { title: 'x' } })).status()).toBe(401);
  });

  test('他人のタスクは見えず、変更も削除もできない', async ({ browser }) => {
    const a = await browser.newPage();
    const b = await browser.newPage();
    await login(a, 'owner-a');
    await addTask(a, 'Aさんの秘密');
    const id = await a.getByTestId('task').first().getAttribute('data-task-id');
    await login(b, 'intruder-b');
    const list = await (await b.request.get('/api/tasks')).json();
    expect(list.find((t: { id: string }) => t.id === id)).toBeUndefined();
    expect((await b.request.patch(`/api/tasks/${id}`, { headers: { origin: ORIGIN }, data: { title: '乗っ取り' } })).status()).toBe(404);
    expect((await b.request.delete(`/api/tasks/${id}`, { headers: { origin: ORIGIN } })).status()).toBe(404);
    expect((await b.request.post(`/api/tasks/${id}/breakdown`, { headers: { origin: ORIGIN } })).status()).toBe(404);
    await a.reload();
    await expect(card(a, 'Aさんの秘密')).toBeVisible();
    await a.close();
    await b.close();
  });

  test('別オリジンからの書き込みは CSRF 対策で拒否される', async ({ page }) => {
    await login(page);
    const evil = await page.request.post('/api/tasks', { headers: { origin: 'https://evil.example.com' }, data: { title: 'x' } });
    expect(evil.status()).toBe(403);
    const noOrigin = await page.request.post('/api/tasks', { data: { title: 'x' } });
    expect(noOrigin.status()).toBe(403);
  });

  test('不正な入力は 400 で拒否される', async ({ page }) => {
    await login(page);
    const h = { origin: ORIGIN };
    expect((await page.request.post('/api/tasks', { headers: h, data: { title: '   ' } })).status()).toBe(400);
    const created = await (await page.request.post('/api/tasks', { headers: h, data: { title: 'ok' } })).json();
    expect((await page.request.patch(`/api/tasks/${created.id}`, { headers: h, data: { status: 'archived' } })).status()).toBe(400);
  });
});
