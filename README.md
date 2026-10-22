# Glass Tasks

フリックでステータスを動かす、モバイルファーストのタスク管理 Web アプリ。
白ベースの Liquid Glass UI、Google ログイン、Workers AI によるタスク分解に対応しています。

## 機能

- **フリックでステータス管理**：カードを右へ弾くと「やること → 進行中 → 完了」、左へ弾くと一つ戻る。「やること」で左に弾くと削除（トーストから元に戻せる）
- **全画面スケルトンローディング**：起動時の読み込み中は、実際の画面と同じ骨組み（ヘッダー・切替・カード・追加ボタン）をシマー表示
- **AI でタスク分解**：詳細シートの「AIで分解」で、Workers AI がすぐ着手できるサブタスクを提案
- **Google 認証のみ**：OAuth 2.0 Authorization Code + PKCE。パスワード管理なし
- **アニメーション**：カードの傾き・色のにじみ・フライアウト、ステータス切替の“しずく”のバネ移動、件数のロール、シート・トースト・リストの出入り、背景の色の移動。OS の「視差効果を減らす」設定に従って抑制

## 技術構成と選定理由

| 領域 | 採用技術 | 選定理由 |
| --- | --- | --- |
| 実行基盤 | **Cloudflare Workers** | Workers AI を使う指定があるため、同じ基盤に API・静的配信・DB・AI を集約するのが最も配線が少ない。エッジで動くのでどこからでも低遅延、無料枠が大きく個人公開に向く |
| 静的配信 | **Workers Static Assets** | フロントと API を 1 つの Worker・1 つのドメインで配信できる。同一オリジンなので CORS 設定が不要になり、Cookie 認証が素直に使える。Pages と分けるより設定が少ない |
| API フレームワーク | **Hono** | Workers 向けに作られた軽量ルーター。Cookie・セキュリティヘッダーなどのミドルウェアが標準で揃い、依存が少ない |
| データベース | **Cloudflare D1** | Workers から追加設定なしで使える SQLite。タスク・ユーザー・セッションのような単純なリレーションに十分で、ローカルでも本番と同じ SQL で動く（E2E テストもこれで実施） |
| AI | **Workers AI**（`@cf/meta/llama-3.3-70b-instruct-fp8-fast`） | 指定どおり。バインディング経由で API キー不要。日本語の指示追従が比較的安定し、JSON スキーマ指定の出力に対応するため、サブタスクを構造化して受け取れる。モデルは `AI_MODEL` 変数で差し替え可能 |
| 認証 | **Google OAuth 2.0 を自前実装**（Authorization Code + PKCE） | 「Google のみ」なら汎用認証ライブラリは過剰。Web Crypto だけで書けるため依存ゼロ・処理内容が読める。PKCE と HMAC 署名付き state で認可コード横取りと CSRF を防ぐ |
| セッション | **HttpOnly Cookie + D1**（トークンは SHA-256 ハッシュで保存） | JWT と違いログアウトで即時失効できる。DB が漏れてもトークン自体は復元できない。JS から読めないので XSS で盗まれにくい |
| フロントエンド | **React 19 + TypeScript** | ジェスチャー・シート・楽観的更新など状態の多い UI を部品化しやすい。アニメーションライブラリの選択肢が最も豊富 |
| ビルド | **Vite** | 起動・HMR が速く、設定がほぼ不要。出力をそのまま Workers Static Assets に渡せる |
| アニメーション・ジェスチャー | **Motion**（旧 Framer Motion） | ドラッグ（フリック）、バネ物理、レイアウトアニメーション（並び替え・“しずく”の移動）、退場アニメーションを 1 つのライブラリで賄える。ポインターイベントベースなのでマウスとタッチの両方で同じコードが動く |
| スタイル | **素の CSS（カスタムプロパティ）** | Liquid Glass は `backdrop-filter`・多層 `box-shadow`・疑似要素の鏡面ハイライトの組み合わせが肝で、ユーティリティクラスより CSS を直接書く方が見通しがよい。色・角丸・ガラスの質感をトークン化 |
| フォント | **Zen Kaku Gothic New** | 角の柔らかいゴシックで、丸みのあるガラス UI と相性がよい。読み込めない環境ではヒラギノ／Noto にフォールバック |
| E2E テスト | **Playwright**（iPhone 13 相当の画面・タッチ有効） | 実ブラウザでマウスとタッチ（CDP の TouchEvent）両方のフリックを再現できる。`webServer` でビルド→ローカル D1 初期化→Worker 起動まで自動化 |
| CI/CD | **GitHub Actions** | 型チェック → E2E を PR ごとに実行し、main への push でテスト合格後に `wrangler deploy` |

### テスト時の工夫

- `wrangler.jsonc` の `env.e2e` 環境は、Google の代わりにテストユーザーでログインできる `/auth/dev-login` を有効にし、AI はモック応答を返します。**本番環境では `ALLOW_DEV_LOGIN` を設定しないため、このエンドポイントは 404 になります。**
- 毎回空の D1 から始めるので、テスト結果が過去のデータに左右されません。

## ディレクトリ構成

```
worker/        Cloudflare Worker（API・認証・AI）
  index.ts     ルーティング、タスク API、CSRF 対策
  auth.ts      Google OAuth（PKCE）・セッション
  ai.ts        Workers AI によるタスク分解
src/           React フロントエンド
  components/  Skeleton / Login / Segments / TaskList（フリック） / Sheet / DetailSheet / Toast
  styles.css   Liquid Glass のトークンとスタイル
migrations/    D1 スキーマ
tests/         Playwright E2E（20 シナリオ）
```

## ローカルで動かす

```bash
npm install
npx wrangler login                      # Workers AI はローカル開発でも Cloudflare 上で実行されるため
cp .dev.vars.example .dev.vars          # Google の ID / Secret などを記入
npm run db:migrate:local
npm run dev                             # http://localhost:5173
```

Google Cloud Console の OAuth クライアントに、承認済みリダイレクト URI として `http://localhost:5173/auth/google/callback` を登録してください。

### テスト

```bash
npx playwright install chromium   # 初回のみ
npm run test:e2e
```

## 公開手順（GitHub → Cloudflare）

1. **GitHub にリポジトリを作成して push**
   ```bash
   git init && git add -A && git commit -m "first commit"
   gh repo create glass-tasks --public --source=. --push
   ```
   （GitHub CLI を使わない場合は、github.com で空のリポジトリを作り `git remote add origin ...` → `git push -u origin main`）
2. **D1 データベースを作成**
   ```bash
   npx wrangler d1 create glass-tasks-db
   ```
   表示された `database_id` を `wrangler.jsonc` の `d1_databases[0].database_id` に貼り付ける。
3. **Google OAuth クライアントを作成**（Google Cloud Console → API とサービス → 認証情報 → OAuth クライアント ID → ウェブアプリケーション）
   - 承認済みの JavaScript 生成元：`https://glass-tasks.<あなたのサブドメイン>.workers.dev`
   - 承認済みのリダイレクト URI：`https://glass-tasks.<あなたのサブドメイン>.workers.dev/auth/google/callback`
   - クライアント ID を `wrangler.jsonc` の `vars.GOOGLE_CLIENT_ID` に、公開 URL を `vars.APP_ORIGIN` に記入
4. **Secret を登録**
   ```bash
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   npx wrangler secret put SESSION_SECRET      # openssl rand -base64 32 の結果など
   ```
5. **デプロイ**
   ```bash
   npm run deploy
   ```
6. **（任意）自動デプロイ**：GitHub の Settings → Secrets and variables → Actions に `CLOUDFLARE_API_TOKEN`（「Edit Cloudflare Workers」テンプレート＋ D1 編集権限）と `CLOUDFLARE_ACCOUNT_ID` を登録すると、main への push でテスト合格後に自動デプロイされます。

## セキュリティ

- 状態を変えるリクエストは Origin ヘッダーが自サイトのものだけ受け付ける（CSRF 対策）
- すべてのタスク操作は `user_id` で絞り込み、他人のタスクは 404
- 入力値は長さ・型・ステータス値をサーバー側で検証
- `secureHeaders` で各種セキュリティヘッダーを付与

## ライセンス

MIT
