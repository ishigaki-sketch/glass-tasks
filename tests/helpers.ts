import { expect, type Locator, type Page } from '@playwright/test';

export const ORIGIN = 'http://localhost:8787';

/** E2E 専用ログイン（Google の代わりにテストユーザーでセッションを発行） */
export async function login(page: Page, sub = `u-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name = 'テスト 太郎') {
  const res = await page.request.post('/auth/dev-login', { headers: { origin: ORIGIN }, data: { sub, name } });
  expect(res.ok()).toBeTruthy();
  await page.goto('/');
  await expect(page.getByTestId('fab')).toBeVisible();
  return sub;
}

export async function addTask(page: Page, title: string) {
  await page.getByTestId('fab').click();
  const sheet = page.getByTestId('add-sheet');
  await expect(sheet).toBeVisible();
  await page.getByTestId('new-title').fill(title);
  const saved = page.waitForResponse((r) => r.url().endsWith('/api/tasks') && r.request().method() === 'POST');
  await page.getByTestId('add-submit').click();
  expect((await saved).status()).toBe(201);
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
}

export function card(page: Page, title: string): Locator {
  return page.getByTestId('task').filter({ hasText: title }).getByTestId('task-card');
}

/** タブ切替の退場アニメーションが終わり、対象が1つだけ表示されるまで待つ */
async function settle(target: Locator) {
  await expect(target).toHaveCount(1);
  await expect(target).toBeVisible();
  await target.scrollIntoViewIfNeeded();
}

/** マウスでカードをフリック（dx>0 で右） */
export async function flick(page: Page, target: Locator, dx: number) {
  await settle(target);
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  const startX = dx > 0 ? box.x + 30 : box.x + box.width - 30;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(startX + (dx * i) / steps, y + (i % 2));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
}

/** 指（タッチイベント）でカードをフリック */
export async function touchFlick(page: Page, target: Locator, dx: number) {
  await settle(target);
  const box = (await target.boundingBox())!;
  const y = box.y + box.height / 2;
  const x0 = dx > 0 ? box.x + 30 : box.x + box.width - 30;
  const cdp = await page.context().newCDPSession(page);
  const point = (x: number) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: point(x0) });
  for (let i = 1; i <= 8; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: point(x0 + (dx * i) / 8) });
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

export async function expectCounts(page: Page, todo: number, doing: number, done: number) {
  await expect(page.getByTestId('count-todo')).toHaveText(String(todo));
  await expect(page.getByTestId('count-doing')).toHaveText(String(doing));
  await expect(page.getByTestId('count-done')).toHaveText(String(done));
}

/** 横スクロールが発生していないこと（モバイルでのはみ出し検出） */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/** 外部フォント（サンドボックスでは到達不可）以外のコンソールエラーを収集 */
export function collectErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = m.location().url ?? '';
    if (/fonts\.(googleapis|gstatic)\.com/.test(url) || /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(m.text())) return;
    errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}
