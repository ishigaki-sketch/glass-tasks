import { defineConfig, devices } from '@playwright/test';

const PORT = 8787;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // モバイルファーストなので iPhone 相当の画面・タッチ有効で検証
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium', defaultBrowserType: 'chromium' } },
  ],
  webServer: {
    // ビルド → 空のローカル D1 にマイグレーション → E2E 環境で Worker を起動
    command:
      'export WRANGLER_SEND_METRICS=false && rm -rf .wrangler/e2e && npx vite build && npx wrangler d1 migrations apply glass-tasks-e2e --local --env e2e --persist-to .wrangler/e2e && npx wrangler dev --env e2e --port 8787 --persist-to .wrangler/e2e',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
